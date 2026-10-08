import env from './config.js';
import { eventConfig } from './event.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function sendReviewConfirmationEmail(registration: {
  id: string;
  email: string;
  name: string;
}) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada.');
  if (!env.EMAIL_FROM) throw new Error('EMAIL_FROM não configurada.');

  const image = await readFile(path.resolve(process.cwd(), 'assets', 'csa10anos_frei.png'));
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  const name = escapeHtml(registration.name);
  const eventName = escapeHtml(eventConfig.eventName);
  const eventDate = escapeHtml(eventConfig.eventDate);
  const eventTime = escapeHtml(eventConfig.eventTime);
  const venue = escapeHtml(eventConfig.venue);
  const address = escapeHtml(eventConfig.address);

  const payload = JSON.stringify({
    from: env.EMAIL_FROM,
    to: [registration.email],
    subject: `Presença confirmada! — ${eventConfig.eventName}`,
    text: `Olá, ${registration.name}!\n\nSeu comprovante de pagamento foi confirmado e seu ingresso para ${eventConfig.eventName} está garantido.\n\nData: ${eventConfig.eventDate}\nHorário: ${eventConfig.eventTime}\nLocal: ${eventConfig.venue}\nEndereço: ${eventConfig.address}\n\nEsperamos você na festa!`,
    html: `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light">
          <meta name="supported-color-schemes" content="light">
        </head>
        <body class="body email-page" bgcolor="#ffffff" style="margin:0;padding:0;color:#000000">
        <div class="gmail-blend-screen">
        <div class="gmail-blend-difference">
        <div class="email-page" style="margin:0;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#000000;">
          <table class="email-card" role="presentation" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #000000;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:0">
                <img src="cid:csa10anos" alt="Ilustração comemorativa dos 10 anos de CSA" style="display:block;width:auto;height:200px;margin:0 auto;">
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 10px">
                <p class="email-label" style="display:block;margin:0 auto 14px;padding:7px 10px;border-radius:4px;background:#000000;color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:2px;text-align:center">INGRESSO • PRESENÇA CONFIRMADA</p>
                <h1 class="email-title" style="margin:0;color:#000000;font-size:30px;line-height:1.15;font-weight:800;text-align:center">${eventName}</h1>
                <p class="email-copy" style="margin:12px 0 0;color:#000000;font-size:16px;text-align:center">Olá, ${name}! Seu comprovante de pagamento foi analisado e confirmado pela organização. <strong>Seu lugar na festa está garantido!</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px">
                <table class="email-rule" role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px dashed #000000;border-bottom:1px dashed #000000">
                  <tr>
                    <td style="padding:18px 0 10px;font-size:12px;font-weight:bold;letter-spacing:1px">DATA E HORÁRIO</td>
                  </tr>
                  <tr>
                    <td class="email-accent" style="padding:0 0 18px;color:#000000;font-size:18px;font-weight:bold">${eventDate} • ${eventTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px">LOCAL</td>
                  </tr>
                  <tr>
                    <td class="email-accent" style="padding:0 0 5px;color:#000000;font-size:18px;font-weight:bold">${venue}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 18px;font-size:14px;line-height:1.5">${address}</td>
                  </tr>
                </table>
                <p class="email-copy" style="margin:20px 0 0;color:#000000;font-size:14px;line-height:1.5">Este ingresso é individual. Até lá!</p>
              </td>
            </tr>
          </table>
          <p class="email-muted" style="margin:18px auto 0;max-width:600px;text-align:center;color:#000000;font-size:12px">${eventName} • Encontro de 10 anos de formados</p>
        </div>
        </div>
        </div>
        </body>
      </html>
      `,
    attachments: [
      {
        filename: 'csa10anos_frei.png',
        content: image.toString('base64'),
        content_type: 'image/png',
        content_id: 'csa10anos',
      },
    ],
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `review-confirmation/${registration.id}`,
        },
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 750);
      continue;
    }

    if (response.ok) return;

    const message = `Resend recusou o envio (${response.status}): ${await response.text()}`;
    if (response.status < 500 && response.status !== 429) throw new Error(message);
    lastError = new Error(message);
    if (attempt < 3) await wait(attempt * 750);
  }

  throw lastError;
}
