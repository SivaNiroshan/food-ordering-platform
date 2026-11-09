import { z } from 'zod';
import { OrderStatus } from '../../generated/prisma/enums.js';
import { paginationQuerySchema } from '../../lib/pagination.js';
import { oneOrMany } from '../../lib/validation.js';

const orderStatusSchema = z.enum(OrderStatus);
const optionalNote = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v ? v : undefined)); // "" becomes undefined

export const idempotencyKeySchema = z.uuid('Idempotency-Key header must be a UUID');

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1, 'An order needs at least one item')
    .max(30)
    .refine(
      (items) => new Set(items.map((i) => i.menuItemId)).size === items.length,
      'Each menu item may appear only once; use quantity instead',
    ),
  notes: optionalNote,
});

export const customerOrdersQuerySchema = paginationQuerySchema.extend({
  status: oneOrMany(orderStatusSchema).optional(),
});

export const staffOrdersQuerySchema = paginationQuerySchema.extend({
  status: oneOrMany(orderStatusSchema).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  customerId: z.uuid().optional(),
  sort: z.enum(['oldest', 'newest']).default('oldest'),
});

export const cancelOrderSchema = z.object({ note: optionalNote });

export const rejectOrderSchema = z
  .object({
    reasonCode: z.enum(['ITEM_UNAVAILABLE', 'KITCHEN_BUSY', 'RESTAURANT_CLOSING', 'OTHER']),
    note: optionalNote,
  })
  .refine((v) => v.reasonCode !== 'OTHER' || v.note, {
    message: 'A note is required when the reason is OTHER',
    path: ['note'],
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CustomerOrdersQuery = z.infer<typeof customerOrdersQuerySchema>;
export type StaffOrdersQuery = z.infer<typeof staffOrdersQuerySchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
