import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Page } from '../../lib/types';

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  /** Decimal string, e.g. "1200.00" */
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  category: { id: string; name: string };
}

export interface MenuFilters {
  search: string;
  categoryId?: string;
  page: number;
}

/** Enough for a single restaurant's menu on one page; pagination still works beyond it. */
const PAGE_SIZE = 50;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories', { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export function useMenuItems({ search, categoryId, page }: MenuFilters) {
  return useQuery({
    queryKey: ['menu-items', { search, categoryId, page }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      return apiRequest<Page<MenuItem>>(`/menu-items?${params}`, { auth: false, signal });
    },
    // Keep showing the previous results while the next ones load, so typing doesn't flicker.
    placeholderData: keepPreviousData,
  });
}

/** Groups items by category, keeping the API's order (category name, then item name). */
export function groupByCategory(items: MenuItem[]) {
  const groups = new Map<string, { id: string; name: string; items: MenuItem[] }>();
  for (const item of items) {
    const group = groups.get(item.category.id) ?? {
      id: item.category.id,
      name: item.category.name,
      items: [],
    };
    group.items.push(item);
    groups.set(item.category.id, group);
  }
  return [...groups.values()];
}