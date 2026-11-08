import type { Prisma } from '../../generated/prisma/client.js';
import { cacheGetOrLoad, invalidateNamespace } from '../../lib/cache.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { toPage, toSkipTake } from '../../lib/pagination.js';
import { isRecordNotFound, isUniqueViolation } from '../../lib/prisma-errors.js';
import { toCategory, toMenuItem, toStaffCategory, toStaffMenuItem } from './menu.mapper.js';
import { menuRepository } from './menu.repository.js';
import type {
  CreateCategoryInput,
  CreateMenuItemInput,
  PublicMenuQuery,
  StaffMenuQuery,
  UpdateCategoryInput,
  UpdateMenuItemInput,
} from './menu.schemas.js';

const CACHE_NAMESPACE = 'menu';
const CACHE_TTL_SECONDS = 60;

const normalizeName = (name: string) => name.trim().toLowerCase();

const menuItemNotFound = () => notFound('MENU_ITEM_NOT_FOUND', 'Menu item not found');
const categoryNotFound = () => notFound('CATEGORY_NOT_FOUND', 'Category not found');
const categoryExists = () =>
  conflict('CATEGORY_ALREADY_EXISTS', 'A category with this name already exists');

async function assertActiveCategory(categoryId: string) {
  const category = await menuRepository.findCategoryById(categoryId);
  if (!category || !category.isActive) {
    throw badRequest('CATEGORY_NOT_FOUND', 'Category does not exist or is inactive');
  }
}

function searchFilter(search: string | undefined): Prisma.MenuItemWhereInput {
  return search ? { name: { contains: search, mode: 'insensitive' } } : {};
}

export const menuService = {
  // ---------- Public ----------

  listCategories() {
    return cacheGetOrLoad(CACHE_NAMESPACE, 'categories', CACHE_TTL_SECONDS, async () => {
      const categories = await menuRepository.listActiveCategories();
      return categories.map(toCategory);
    });
  },

  listItems(query: PublicMenuQuery) {
    // The key is built from the VALIDATED query, so ?page=1 and ?page=01 share one entry.
    const key = `items:${JSON.stringify(query)}`;
    return cacheGetOrLoad(CACHE_NAMESPACE, key, CACHE_TTL_SECONDS, async () => {
      const where: Prisma.MenuItemWhereInput = {
        ...menuRepository.publicItemWhere,
        ...searchFilter(query.search),
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.availableOnly && { isAvailable: true }),
      };
      const { skip, take } = toSkipTake(query);
      const { items, total } = await menuRepository.listItems(where, skip, take);
      return toPage(items.map(toMenuItem), total, query);
    });
  },

  getItem(id: string) {
    return cacheGetOrLoad(CACHE_NAMESPACE, `item:${id}`, CACHE_TTL_SECONDS, async () => {
      const item = await menuRepository.findPublicItemById(id);
      if (!item) throw menuItemNotFound();
      return toMenuItem(item);
    });
  },

  // ---------- Staff: categories ----------

  async listAllCategories() {
    const categories = await menuRepository.listAllCategories();
    return categories.map(toStaffCategory);
  },

  async createCategory(input: CreateCategoryInput) {
    try {
      const category = await menuRepository.createCategory({
        name: input.name,
        nameNormalized: normalizeName(input.name),
        description: input.description,
      });
      await invalidateNamespace(CACHE_NAMESPACE);
      return toStaffCategory(category);
    } catch (err) {
      if (isUniqueViolation(err)) throw categoryExists();
      throw err;
    }
  },

  async updateCategory(id: string, input: UpdateCategoryInput) {
    try {
      const category = await menuRepository.updateCategory(id, {
        ...input,
        ...(input.name !== undefined && { nameNormalized: normalizeName(input.name) }),
      });
      await invalidateNamespace(CACHE_NAMESPACE);
      return toStaffCategory(category);
    } catch (err) {
      if (isUniqueViolation(err)) throw categoryExists();
      if (isRecordNotFound(err)) throw categoryNotFound();
      throw err;
    }
  },

  // ---------- Staff: menu items ----------

  async listAllItems(query: StaffMenuQuery) {
    const where: Prisma.MenuItemWhereInput = {
      ...searchFilter(query.search),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.isAvailable !== undefined && { isAvailable: query.isAvailable }),
    };
    const { skip, take } = toSkipTake(query);
    const { items, total } = await menuRepository.listItems(where, skip, take);
    return toPage(items.map(toStaffMenuItem), total, query);
  },

  async createItem(input: CreateMenuItemInput) {
    await assertActiveCategory(input.categoryId);
    const item = await menuRepository.createItem(input);
    await invalidateNamespace(CACHE_NAMESPACE);
    return toStaffMenuItem(item);
  },

  async updateItem(id: string, input: UpdateMenuItemInput) {
    if (input.categoryId) await assertActiveCategory(input.categoryId);
    try {
      const item = await menuRepository.updateItem(id, input);
      await invalidateNamespace(CACHE_NAMESPACE);
      return toStaffMenuItem(item);
    } catch (err) {
      if (isRecordNotFound(err)) throw menuItemNotFound();
      throw err;
    }
  },
};
