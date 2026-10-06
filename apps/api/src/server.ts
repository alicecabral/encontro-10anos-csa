import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import env from './config.js';
import { eventConfig } from './event.js';
import { sendReviewConfirmationEmail } from './email.js';
import { auth } from './auth.js';
import {
  LOT_CAPACITIES,
  TOTAL_TICKET_LIMIT,
  getLotCapacity,
  graduationYearFromClassOf2016Answer,
  isLotAvailableByRelease,
} from './rules.js';

const prisma = new PrismaClient();
const app = express();
const safeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const ensureAdminAccount = async () => {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
};
const r2 =
  env.R2_ENDPOINT && env.R2_BUCKET_NAME
    ? new S3Client({
        endpoint: env.R2_ENDPOINT,
        region: 'auto',
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
        },
      })
    : null;
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60e3, max: 200 }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE, files: 1 },
  fileFilter: (_, file, cb) =>
    cb(null, safeTypes.has(file.mimetype) && !/[\\/]/.test(file.originalname)),
});
const getSpotsUntilNextLot = (lots: any[], totalSold: number) => {
  if (totalSold >= TOTAL_TICKET_LIMIT) return 0;
  const currentLot = lots.find((lot) => isLotAvailableByRelease(lot, totalSold));
  if (!currentLot) return 0;

  const nextThreshold = LOT_CAPACITIES.slice(0, currentLot.displayOrder).reduce(
    (sum, capacity) => sum + capacity,
    0,
  );
  return Math.max(0, nextThreshold - totalSold);
};
const serialize = (registration: any) => ({
  ...registration,
  amountPaid: Number(registration.amountPaid),
  lot: registration.lot
    ? { ...registration.lot, price: Number(registration.lot.price) }
    : undefined,
});
async function putFile(key: string, file: Express.Multer.File) {
  if (r2)
    return r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
      }),
    );
  const folder = path.resolve('uploads');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, path.basename(key)), file.buffer);
}
async function deleteFile(key: string) {
  if (r2) return r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME!, Key: key }));
  await fs.unlink(path.join(path.resolve('uploads'), path.basename(key))).catch(() => {});
}

app.get('/api/event', (_, res) => res.json(eventConfig));
app.get('/api/lots', async (_, res) => {
  const lots = await prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } });
  const totalSold = lots.reduce((sum, lot) => sum + lot.quantitySold, 0);
  res.json(
    lots.map((lot) => ({
      ...lot,
      price: Number(lot.price),
      isCurrent: isLotAvailableByRelease(lot, totalSold),
    })),
  );
});
app.get('/api/lots/current', async (_, res) => {
  const lots = await prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } });
  const totalSold = lots.reduce((sum, lot) => sum + lot.quantitySold, 0);
  const lot = lots.find((entry) => isLotAvailableByRelease(entry, totalSold));
  if (!lot)
    return res.status(404).json({ message: 'No momento não há lotes disponíveis para compra.' });
  res.json({ ...lot, price: Number(lot.price) });
});
app.post('/api/registrations', upload.single('proof'), async (req, res, next) => {
  let key: string | undefined;
  try {
    const data = z
      .object({
        name: z.string().trim().min(3).max(120),
        phone: z.string().min(10).max(20),
        email: z.string().trim().email().max(254),
        graduatedFromSchool: z.enum(['true', 'false']),
        lotId: z.string().uuid(),
      })
      .parse(req.body);
    if (!req.file || !safeTypes.has(req.file.mimetype))
      return res.status(400).json({ message: 'Envie um comprovante válido (imagem ou PDF).' });
    const graduated = data.graduatedFromSchool === 'true';
    const lots = await prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } });
    const totalSold = lots.reduce((sum, lot) => sum + lot.quantitySold, 0);
    if (totalSold >= TOTAL_TICKET_LIMIT)
      return res.status(409).json({
        message: 'As inscrições para este evento já esgotaram.',
      });
    const lot = await prisma.lot.findUnique({ where: { id: data.lotId } });
    if (!lot || !isLotAvailableByRelease(lot, totalSold))
      return res.status(409).json({
        message:
          'Este lote não está mais disponível. Atualize a página para consultar o lote atual.',
      });
    key = `event-proofs/${new Date().getFullYear()}/${crypto.randomUUID()}${path.extname(req.file.originalname).toLowerCase()}`;
    await putFile(key, req.file);
    const idempotencyKey = req.header('Idempotency-Key') || undefined;
    const registration = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.registration.findUnique({
          where: { idempotencyKey },
          include: { lot: true },
        });
        if (existing) return existing;
      }
      const created = await tx.registration.create({
        data: {
          name: data.name.replace(/\s+/g, ' '),
          phone: data.phone.replace(/\D/g, ''),
          email: data.email.toLowerCase(),
          graduatedFromSchool: graduated,
          graduationYear: graduationYearFromClassOf2016Answer(graduated),
          lotId: lot.id,
          amountPaid: lot.price,
          paymentStatus: 'CONFIRMED',
          proofFileKey: key!,
          proofOriginalName: path.basename(req.file!.originalname),
          proofMimeType: req.file!.mimetype,
          proofSize: req.file!.size,
          idempotencyKey,
        },
        include: { lot: true },
      });
      await tx.lot.update({ where: { id: lot.id }, data: { quantitySold: { increment: 1 } } });
      return created;
    });
    res.status(201).json({
      registration: serialize(registration),
      message: 'Sua presença foi confirmada e o comprovante foi recebido!',
    });
  } catch (error) {
    if (key) await deleteFile(key);
    next(error);
  }
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash)))
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    const token = jwt.sign({ id: admin.id, email: admin.email }, env.JWT_SECRET, {
      expiresIn: '8h',
    });
    res.json({ email: admin.email, token });
  } catch (error) {
    next(error);
  }
});
app.post('/api/admin/logout', (_, res) => {
  res.status(204).end();
});
app.get('/api/admin/me', auth, (req: any, res) => res.json({ email: req.admin.email }));
app.get('/api/admin/dashboard', auth, async (_, res) => {
  const [confirmed, pending, revenue, lots] = await Promise.all([
    prisma.registration.count({ where: { reviewStatus: 'CONFIRMED' } }),
    prisma.registration.count({ where: { reviewStatus: 'PENDING' } }),
    prisma.registration.aggregate({
      where: { reviewStatus: { not: 'REJECTED' } },
      _sum: { amountPaid: true },
    }),
    prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } }),
  ]);
  const totalSold = lots.reduce((sum, lot) => sum + lot.quantitySold, 0);
  const currentLot = lots.find((lot) => isLotAvailableByRelease(lot, totalSold));
  const spotsUntilNextLot = getSpotsUntilNextLot(lots, totalSold);
  res.json({
    confirmed,
    pending,
    revenue: Number(revenue._sum.amountPaid || 0),
    currentLot: currentLot ? { name: currentLot.name, price: Number(currentLot.price) } : null,
    spotsUntilNextLot,
  });
});
app.get('/api/admin/registrations', auth, async (req, res) => {
  const q = req.query as any,
    page = Math.max(1, Number(q.page) || 1),
    limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  const where: any = { AND: [] };
  if (q.search)
    where.AND.push({
      OR: ['name', 'email', 'phone'].map((field) => ({
        [field]: { contains: q.search, mode: 'insensitive' },
      })),
    });
  if (q.lotId) where.AND.push({ lotId: q.lotId });
  if (q.graduatedFromSchool !== undefined)
    where.AND.push({ graduatedFromSchool: q.graduatedFromSchool === 'true' });
  if (q.graduationYear) where.AND.push({ graduationYear: Number(q.graduationYear) });
  const orderBy: any = {
    [['name', 'submittedAt', 'amountPaid'].includes(q.sort) ? q.sort : 'submittedAt']:
      q.order === 'asc' ? 'asc' : 'desc',
  };
  const [total, items] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      include: { lot: true },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  res.json({ items: items.map(serialize), total, page, limit });
});
app.patch('/api/admin/registrations/:id/review', auth, async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['CONFIRMED', 'REJECTED']) }).parse(req.body);
    const id = z.string().uuid().parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const changed = await tx.registration.updateMany({
        where: { id, reviewStatus: 'PENDING' },
        data: { reviewStatus: status },
      });
      const registration = await tx.registration.findUnique({ where: { id } });

      if (changed.count && status === 'REJECTED' && registration) {
        await tx.lot.update({
          where: { id: registration.lotId },
          data: { quantitySold: { decrement: 1 } },
        });
      }

      return { registration, changed: changed.count > 0 };
    });

    if (!result.registration) return res.status(404).json({ message: 'Inscrição não encontrada.' });
    if (!result.changed && result.registration.reviewStatus !== status)
      return res.status(409).json({ message: 'Esta inscrição já foi analisada.' });

    if (result.changed && status === 'CONFIRMED') {
      void sendReviewConfirmationEmail(result.registration).catch((error) => {
        console.error('Não foi possível enviar o e-mail de confirmação do comprovante:', error);
      });
    }

    res.json({ id: result.registration.id, reviewStatus: result.registration.reviewStatus });
  } catch (error) {
    next(error);
  }
});
app.get('/api/admin/registrations/export', auth, async (_, res) => {
  const rows = await prisma.registration.findMany({
    include: { lot: true },
    orderBy: { submittedAt: 'desc' },
  });
  res
    .header('Content-Type', 'text/csv; charset=utf-8')
    .attachment('inscricoes.csv')
    .send(
      stringify(
        rows.map((row) => [
          row.id,
          row.name,
          row.phone,
          row.email,
          row.graduatedFromSchool && row.graduationYear === 2016 ? 'Sim' : 'Não',
          row.lot.name,
          Number(row.amountPaid),
          row.submittedAt.toISOString(),
        ]),
        {
          header: true,
          columns: [
            'ID',
            'Nome',
            'Telefone',
            'Email',
            'É do terceiro ano 2016?',
            'Lote',
            'Valor pago',
            'Data de submissão',
          ],
        },
      ),
    );
});
app.get('/api/admin/registrations/:id/proof', auth, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ message: 'Inscrição não encontrada.' });
    if (r2) {
      const url = await getSignedUrl(
        r2,
        new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME!,
          Key: registration.proofFileKey,
          ResponseContentType: registration.proofMimeType,
          ResponseContentDisposition: `inline; filename="${registration.proofOriginalName.replace(/"/g, '')}"`,
        }),
        { expiresIn: 300 },
      );
      return res.json({ url, expiresIn: 300 });
    }
    res
      .type(registration.proofMimeType)
      .sendFile(path.join(path.resolve('uploads'), path.basename(registration.proofFileKey)));
  } catch (error) {
    next(error);
  }
});
app.use((error: any, _req: any, res: any, _next: any) => {
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'O arquivo excede o tamanho permitido.'
          : 'Erro no envio do arquivo.',
    });
  if (error instanceof z.ZodError)
    return res.status(400).json({
      message: 'Preencha os campos obrigatórios com dados válidos.',
      errors: error.flatten(),
    });
  console.error(error);
  res.status(500).json({ message: 'Não foi possível concluir a solicitação. Tente novamente.' });
});

const start = async () => {
  await ensureAdminAccount();
  app.listen(env.PORT, () => {
    console.log(`API em http://localhost:${env.PORT}`);
    console.log(
      r2
        ? `Armazenamento R2 ativo: ${env.R2_BUCKET_NAME}`
        : 'Armazenamento local ativo (R2 não configurado).',
    );
  });
};

start().catch((error) => {
  console.error('Erro ao iniciar a API:', error);
  process.exit(1);
});
