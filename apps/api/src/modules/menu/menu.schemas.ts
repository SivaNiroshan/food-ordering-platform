import { z } from 'zod';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { moneySchema } from '../../lib/validation.js';

const atLeastOneField = (obj: Record<string, unknown>) =>
  Object.values(obj).some((value) => value !== undefined);

const searchSchema = z.string().trim().min(1).max(100).optional();

// ---------- Query strings ----------
// Note: z.stringbool() parses "true"/"false" correctly. z.coerce.boolean() would turn "false" into true.

export const publicMenuQuerySchema = paginationQuerySchema.extend({
  search: searchSchema,
  categoryId: z.uuid().optional(),
  availableOnly: z.stringbool().default(false),
});

export const staffMenuQuerySchema = paginationQuerySchema.extend({
  search: searchSchema,
  categoryId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  isAvailable: z.stringbool().optional(),
});

// ---------- Categories ----------

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(atLeastOneField, 'At least one field must be provided');

// ---------- Menu items ----------

const imageUrlSchema = z.url({ protocol: /^https$/, error: 'Must be a valid https URL' }).max(2048);

export const createMenuItemSchema = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  price: moneySchema,
  imageUrl: imageUrlSchema.optional(),
  isAvailable: z.boolean().default(true),
});

export const updateMenuItemSchema = z
  .object({
    categoryId: z.uuid().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    price: moneySchema.optional(),
    imageUrl: imageUrlSchema.nullable().optional(),
    isAvailable: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(atLeastOneField, 'At least one field must be provided');

export type PublicMenuQuery = z.infer<typeof publicMenuQuerySchema>;
export type StaffMenuQuery = z.infer<typeof staffMenuQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
