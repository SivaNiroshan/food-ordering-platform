import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { idParamSchema } from '../../lib/validation.js';
import {
  cancelOrderSchema,
  createOrderSchema,
  customerOrdersQuerySchema,
  idempotencyKeySchema,
  rejectOrderSchema,
  staffOrdersQuerySchema,
} from './orders.schemas.js';
import { ordersService } from './orders.service.js';
import type { StaffAction } from './orders.state-machine.js';

export const ordersController = {
  // ---------- Customer ----------

  async place(req: Request, res: Response) {
    const customer = getAuthUser(req);
    const idempotencyKey = idempotencyKeySchema.parse(req.get('Idempotency-Key'));
    const input = createOrderSchema.parse(req.body);

    const { order, replayed } = await ordersService.placeOrder(customer.id, idempotencyKey, input);

    if (replayed) res.set('Idempotent-Replayed', 'true');
    res.status(replayed ? 200 : 201).json(order);
  },

  async listMine(req: Request, res: Response) {
    const query = customerOrdersQuerySchema.parse(req.query);
    res.json(await ordersService.listForCustomer(getAuthUser(req).id, query));
  },

  async getMine(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await ordersService.getForCustomer(getAuthUser(req).id, id));
  },

  async cancelMine(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { note } = cancelOrderSchema.parse(req.body ?? {});
    res.json(await ordersService.cancelByCustomer(getAuthUser(req).id, id, note));
  },

  // ---------- Staff ----------

  async listAll(req: Request, res: Response) {
    const query = staffOrdersQuerySchema.parse(req.query);
    res.json(await ordersService.listForStaff(query));
  },

  async getAny(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await ordersService.getForStaff(id));
  },

  staffAction(action: StaffAction) {
    return async (req: Request, res: Response) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await ordersService.staffAction(getAuthUser(req).id, id, action));
    };
  },

  async reject(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = rejectOrderSchema.parse(req.body ?? {});
    res.json(await ordersService.reject(getAuthUser(req).id, id, input));
  },
};
