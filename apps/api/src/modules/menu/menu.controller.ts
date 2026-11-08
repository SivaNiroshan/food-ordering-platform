import type { Request, Response } from 'express';
import { idParamSchema } from '../../lib/validation.js';
import {
  createCategorySchema,
  createMenuItemSchema,
  publicMenuQuerySchema,
  staffMenuQuerySchema,
  updateCategorySchema,
  updateMenuItemSchema,
} from './menu.schemas.js';
import { menuService } from './menu.service.js';

export const menuController = {
  // ---------- Public ----------

  async listCategories(_req: Request, res: Response) {
    res.json(await menuService.listCategories());
  },

  async listItems(req: Request, res: Response) {
    const query = publicMenuQuerySchema.parse(req.query);
    res.json(await menuService.listItems(query));
  },

  async getItem(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await menuService.getItem(id));
  },

  // ---------- Staff ----------

  async listAllCategories(_req: Request, res: Response) {
    res.json(await menuService.listAllCategories());
  },

  async createCategory(req: Request, res: Response) {
    const input = createCategorySchema.parse(req.body);
    res.status(201).json(await menuService.createCategory(input));
  },

  async updateCategory(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = updateCategorySchema.parse(req.body ?? {});
    res.json(await menuService.updateCategory(id, input));
  },

  async listAllItems(req: Request, res: Response) {
    const query = staffMenuQuerySchema.parse(req.query);
    res.json(await menuService.listAllItems(query));
  },

  async createItem(req: Request, res: Response) {
    const input = createMenuItemSchema.parse(req.body);
    res.status(201).json(await menuService.createItem(input));
  },

  async updateItem(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const input = updateMenuItemSchema.parse(req.body ?? {});
    res.json(await menuService.updateItem(id, input));
  },
};
