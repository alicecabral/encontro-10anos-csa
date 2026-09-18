import nodemailer from 'nodemailer';
import env from './config.js';
import { eventConfig } from './event.js';

/** Optional, deliberately non-blocking email delivery service. */
export async function sendRegistrationEmail(registration: {
  email: string;
  name: string;
  amountPaid: number;
  lot: { name: string };
}) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM) return;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    secure: (env.SMTP_PORT || 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: registration.email,
    subject: `Inscrição registrada — ${eventConfig.eventName}`,
    text: `Olá, ${registration.name}!\n\nSua inscrição para ${eventConfig.eventName} foi registrada.\nLote: ${registration.lot.name}\nValor: R$ ${registration.amountPaid.toFixed(2)}\n\nSeu comprovante será conferido pela organização.`,
  });
}
