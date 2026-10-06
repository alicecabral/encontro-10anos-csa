import nodemailer from 'nodemailer';
import env from './config.js';
import { eventConfig } from './event.js';

export async function sendReviewConfirmationEmail(registration: { email: string; name: string }) {
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
    subject: `Comprovante confirmado — ${eventConfig.eventName}`,
    text: `Olá, ${registration.name}!\n\nSeu comprovante de pagamento foi analisado e confirmado pela organização. Sua inscrição para ${eventConfig.eventName} está confirmada.\n\nEsperamos você no evento!`,
  });
}
