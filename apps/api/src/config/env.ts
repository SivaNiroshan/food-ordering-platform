import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
