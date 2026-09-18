/* Temporary compatibility declarations for packages that do not bundle types. */
declare module 'cors' {
  import { RequestHandler } from 'express';
  export default function cors(options?: unknown): RequestHandler;
}

declare module 'nodemailer' {
  interface Transporter {
    sendMail(message: unknown): Promise<unknown>;
  }
  function createTransport(options: unknown): Transporter;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
