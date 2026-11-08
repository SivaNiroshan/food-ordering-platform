import type { Category, Prisma } from '../../generated/prisma/client.js';

type MenuItemWithCategory = Prisma.MenuItemGetPayload<{ include: { category: true } }>;

export function toCategory(category: Category) {
  return { id: category.id, name: category.name, description: category.description };
}

export function toStaffCategory(category: Category) {
  return {
    ...toCategory(category),
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toMenuItem(item: MenuItemWithCategory) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price.toFixed(2),
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    category: { id: item.category.id, name: item.category.name },
  };
}

export function toStaffMenuItem(item: MenuItemWithCategory) {
  return {
    ...toMenuItem(item),
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
