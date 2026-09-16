import 'dotenv/config'; import { PrismaClient } from '@prisma/client'; import bcrypt from 'bcrypt';
const prisma=new PrismaClient(); const now=new Date();
await prisma.admin.upsert({where:{email:process.env.ADMIN_EMAIL||'admin@example.com'},update:{},create:{email:process.env.ADMIN_EMAIL||'admin@example.com',passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD||'change-me-in-development',12)}});
const years=[[-30,30],[31,60],[61,90]]; for(const [i,r] of years.entries()) await prisma.lot.upsert({where:{displayOrder:i+1},update:{},create:{name:`${i+1}º Lote`,price:0,startDate:new Date(now.getTime()+r[0]*864e5),endDate:new Date(now.getTime()+r[1]*864e5),active:true,displayOrder:i+1}}); await prisma.$disconnect();
