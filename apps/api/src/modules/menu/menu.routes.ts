import { Router } from 'express';
import { menuController } from './menu.controller.js';

// ---------- Public (mounted at /categories and /menu-items) ----------

export const publicCategoriesRouter = Router();
publicCategoriesRouter.get('/', menuController.listCategories);

export const publicMenuItemsRouter = Router();
publicMenuItemsRouter.get('/', menuController.listItems);
publicMenuItemsRouter.get('/:id', menuController.getItem);

// ---------- Staff (mounted under /staff, which already requires STAFF or ADMIN) ----------

export const staffCategoriesRouter = Router();
staffCategoriesRouter.get('/', menuController.listAllCategories);
staffCategoriesRouter.post('/', menuController.createCategory);
staffCategoriesRouter.patch('/:id', menuController.updateCategory);

export const staffMenuItemsRouter = Router();
staffMenuItemsRouter.get('/', menuController.listAllItems);
staffMenuItemsRouter.post('/', menuController.createItem);
staffMenuItemsRouter.patch('/:id', menuController.updateItem);
