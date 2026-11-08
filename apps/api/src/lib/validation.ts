import { z } from 'zod';

// Reusable building blocks for request validation.

export const idParamSchema = z.object({ id: z.uuid('Invalid id') });

export const emailSchema = z.string().trim().max(255).pipe(z.email('Invalid email address'));

export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long');

// Up to 8 digits before the point and 2 after: exactly what DECIMAL(10,2) can hold.
export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Must be a non-negative amount with at most 2 decimal places');

// Accepts ?status=A or ?status=A&status=B
export const oneOrMany = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.array(schema)]).transform((v) => (Array.isArray(v) ? v : [v]));
