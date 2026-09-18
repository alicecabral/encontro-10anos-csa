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

const prisma = new PrismaClient();
const app = express();
const safeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
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
const auth = (req: any, res: any, next: any) => {
  try {
    req.admin = jwt.verify(req.cookies.admin_token, env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Autenticação necessária.' });
  }
};
const available = (lot: any) =>
  lot.active &&
  new Date() >= lot.startDate &&
  new Date() <= lot.endDate &&
  (lot.quantityLimit === null || lot.quantitySold < lot.quantityLimit);
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
app.get('/api/lots', async (_, res) =>
  res.json(
    (await prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } })).map((lot) => ({
      ...lot,
      price: Number(lot.price),
      isCurrent: available(lot),
    })),
  ),
);
app.get('/api/lots/current', async (_, res) => {
  const lot = (await prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } })).find(available);
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
        graduationYear: z.string().optional(),
        lotId: z.string().uuid(),
      })
      .parse(req.body);
    if (!req.file || !safeTypes.has(req.file.mimetype))
      return res.status(400).json({ message: 'Envie um comprovante válido (imagem ou PDF).' });
    const graduated = data.graduatedFromSchool === 'true';
    const year = graduated ? Number(data.graduationYear) : null;
    if (graduated && (!Number.isInteger(year) || year! < 1900 || year! > new Date().getFullYear()))
      return res.status(400).json({ message: 'Informe um ano de formação válido.' });
    const lot = await prisma.lot.findUnique({ where: { id: data.lotId } });
    if (!lot || !available(lot))
      return res
        .status(409)
        .json({
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
          graduationYear: year,
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
    res
      .status(201)
      .json({
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
    res
      .cookie(
        'admin_token',
        jwt.sign({ id: admin.id, email: admin.email }, env.JWT_SECRET, { expiresIn: '8h' }),
        {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 288e5,
        },
      )
      .json({ email: admin.email });
  } catch (error) {
    next(error);
  }
});
app.post('/api/admin/logout', (_, res) => {
  res.clearCookie('admin_token');
  res.status(204).end();
});
app.get('/api/admin/me', auth, (req: any, res) => res.json({ email: req.admin.email }));
app.get('/api/admin/dashboard', auth, async (_, res) => {
  const [confirmed, revenue, lots] = await Promise.all([
    prisma.registration.count(),
    prisma.registration.aggregate({ _sum: { amountPaid: true } }),
    prisma.lot.findMany({ orderBy: { displayOrder: 'asc' } }),
  ]);
  const currentLot = lots.find(available);
  const spotsUntilNextLot = currentLot
    ? currentLot.quantityLimit === null
      ? null
      : Math.max(0, currentLot.quantityLimit - currentLot.quantitySold)
    : null;
  res.json({
    confirmed,
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
          row.graduatedFromSchool ? 'Sim' : 'Não',
          row.graduationYear || '',
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
            'Formado no Santo Antônio',
            'Ano de formação',
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
    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
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
    return res
      .status(400)
      .json({
        message:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'O arquivo excede o tamanho permitido.'
            : 'Erro no envio do arquivo.',
      });
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({
        message: 'Preencha os campos obrigatórios com dados válidos.',
        errors: error.flatten(),
      });
  console.error(error);
  res.status(500).json({ message: 'Não foi possível concluir a solicitação. Tente novamente.' });
});
app.listen(env.PORT, () => console.log(`API em http://localhost:${env.PORT}`));
