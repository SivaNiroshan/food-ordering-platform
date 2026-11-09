import { Router } from 'express';
import { adminUsersController } from './admin-users.controller.js';

// Mounted under /admin, which already requires the ADMIN role.
export const adminUsersRouter = Router();
adminUsersRouter.get('/', adminUsersController.list);
adminUsersRouter.post('/', adminUsersController.create);
adminUsersRouter.get('/:id', adminUsersController.get);
adminUsersRouter.patch('/:id/role', adminUsersController.changeRole);
adminUsersRouter.patch('/:id/status', adminUsersController.changeStatus);