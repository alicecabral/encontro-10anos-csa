import 'dotenv/config';
import { z } from 'zod';

const env = z
  .object({
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(32),
    ADMIN_EMAIL: z.string().default('admin@example.com'),
    ADMIN_PASSWORD: z.string().default('change-me-in-development'),
    CORS_ORIGIN: z.string().default('http://localhost:4200'),
    MAX_UPLOAD_SIZE: z.coerce.number().default(52428800),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_ENDPOINT: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .parse(process.env);

export default env;
