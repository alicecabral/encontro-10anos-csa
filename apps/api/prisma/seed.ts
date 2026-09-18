import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const now = new Date();
const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'change-me-in-development';
const passwordHash = await bcrypt.hash(password, 12);

await prisma.admin.upsert({
  where: { email },
  update: { passwordHash },
  create: { email, passwordHash },
});
const years = [
  [-30, 30],
  [31, 60],
  [61, 90],
];
for (const [i, r] of years.entries())
  await prisma.lot.upsert({
    where: { displayOrder: i + 1 },
    update: {},
    create: {
      name: `${i + 1}º Lote`,
      price: 0,
      startDate: new Date(now.getTime() + r[0] * 864e5),
      endDate: new Date(now.getTime() + r[1] * 864e5),
      active: true,
      displayOrder: i + 1,
    },
  });
await prisma.$disconnect();
