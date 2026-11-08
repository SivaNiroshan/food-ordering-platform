import { z } from 'zod';

const email = z.string().trim().max(255).pipe(z.email('Invalid email address'));

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password is too long');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password: newPassword,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
