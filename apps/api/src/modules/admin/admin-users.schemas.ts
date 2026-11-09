import { z } from 'zod';
import { UserRole } from '../../generated/prisma/enums.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { emailSchema, newPasswordSchema } from '../../lib/validation.js';

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(UserRole).optional(),
  isActive: z.stringbool().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const createStaffUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: newPasswordSchema,
  role: z.enum(['STAFF', 'ADMIN']),
});

export const changeRoleSchema = z.object({ role: z.enum(UserRole) });

export const changeStatusSchema = z.object({ isActive: z.boolean() });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;