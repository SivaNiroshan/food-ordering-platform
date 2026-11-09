import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authenticate.js';
import { idParamSchema } from '../../lib/validation.js';
import {
  changeRoleSchema,
  changeStatusSchema,
  createStaffUserSchema,
  listUsersQuerySchema,
} from './admin-users.schemas.js';
import { adminUsersService } from './admin-users.service.js';

export const adminUsersController = {
  async list(req: Request, res: Response) {
    res.json(await adminUsersService.list(listUsersQuerySchema.parse(req.query)));
  },

  async get(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await adminUsersService.get(id));
  },

  async create(req: Request, res: Response) {
    const input = createStaffUserSchema.parse(req.body);
    res.status(201).json(await adminUsersService.createStaffUser(input));
  },

  async changeRole(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { role } = changeRoleSchema.parse(req.body);
    res.json(await adminUsersService.changeRole(getAuthUser(req).id, id, role));
  },

  async changeStatus(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const { isActive } = changeStatusSchema.parse(req.body);
    res.json(await adminUsersService.changeStatus(getAuthUser(req).id, id, isActive));
  },
};