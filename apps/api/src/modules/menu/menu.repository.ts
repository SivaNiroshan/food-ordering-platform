import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../lib/prisma.js';

const withCategory = { category: true } as const;

const menuOrder: Prisma.MenuItemOrderByWithRelationInput[] = [
  { category: { name: 'asc' } },
  { name: 'asc' },
];

// What customers may see: active items in active categories.
const publicItemWhere: Prisma.MenuItemWhereInput = { isActive: true, category: { isActive: true } };

export const menuRepository = {
  // ---------- Categories ----------

  listActiveCategories() {
    return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  },

  listAllCategories() {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  },

  findCategoryById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  createCategory(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  // ---------- Menu items ----------

  async listItems(where: Prisma.MenuItemWhereInput, skip: number, take: number) {
    const [items, total] = await prisma.$transaction([
      prisma.menuItem.findMany({ where, include: withCategory, orderBy: menuOrder, skip, take }),
      prisma.menuItem.count({ where }),
    ]);
    return { items, total };
  },

  publicItemWhere,

  findPublicItemById(id: string) {
    return prisma.menuItem.findFirst({ where: { id, ...publicItemWhere }, include: withCategory });
  },

  findItemById(id: string) {
    return prisma.menuItem.findUnique({ where: { id }, include: withCategory });
  },

  createItem(data: Prisma.MenuItemUncheckedCreateInput) {
    return prisma.menuItem.create({ data, include: withCategory });
  },

  updateItem(id: string, data: Prisma.MenuItemUncheckedUpdateInput) {
    return prisma.menuItem.update({ where: { id }, data, include: withCategory });
  },
};
