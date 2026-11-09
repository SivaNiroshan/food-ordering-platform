import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { ordersController } from './orders.controller.js';

// ---------- Customer: /orders ----------

export const customerOrdersRouter = Router();
customerOrdersRouter.use(authenticate, requireRole('CUSTOMER'));
customerOrdersRouter.post('/', ordersController.place);
customerOrdersRouter.get('/', ordersController.listMine);
customerOrdersRouter.get('/:id', ordersController.getMine);
customerOrdersRouter.post('/:id/cancel', ordersController.cancelMine);

// ---------- Staff: /staff/orders (the /staff router already requires STAFF or ADMIN) ----------

const staffOnly = requireRole('STAFF'); // admins can view orders but not process them

export const staffOrdersRouter = Router();
staffOrdersRouter.get('/', ordersController.listAll);
staffOrdersRouter.get('/:id', ordersController.getAny);
staffOrdersRouter.post('/:id/accept', staffOnly, ordersController.staffAction('accept'));
staffOrdersRouter.post('/:id/reject', staffOnly, ordersController.reject);
staffOrdersRouter.post(
  '/:id/start-preparing',
  staffOnly,
  ordersController.staffAction('start-preparing'),
);
staffOrdersRouter.post('/:id/mark-ready', staffOnly, ordersController.staffAction('mark-ready'));
staffOrdersRouter.post('/:id/complete', staffOnly, ordersController.staffAction('complete'));
