import env from './config.js';
import { eventConfig } from './event.js';

export async function sendReviewConfirmationEmail(registration: { email: string; name: string }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada.');
  if (!env.EMAIL_FROM) throw new Error('EMAIL_FROM não configurada.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [registration.email],
      subject: `Comprovante confirmado — ${eventConfig.eventName}`,
      text: `Olá, ${registration.name}!\n\nSeu comprovante de pagamento foi analisado e confirmado pela organização. Sua inscrição para ${eventConfig.eventName} está confirmada.\n\nEsperamos você no evento!`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend recusou o envio (${response.status}): ${await response.text()}`);
  }
}
