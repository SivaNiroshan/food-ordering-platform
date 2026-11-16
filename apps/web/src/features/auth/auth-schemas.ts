import { z } from 'zod';

// Same rules as the API (apps/api/src/lib/validation.ts), so users see problems before
// submitting. The API still validates everything: client checks are only for convenience.

const email = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  email,
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .refine((p) => new TextEncoder().encode(p).length <= 72, 'Use 72 characters or fewer'),
});

/** Turns a failed Zod parse into { field: firstMessage }. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !result[field]) result[field] = issue.message;
  }
  return result;
}
