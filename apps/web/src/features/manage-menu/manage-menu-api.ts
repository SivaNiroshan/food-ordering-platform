import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Page } from '../../lib/types';
import type { Category, MenuItem } from '../menu/menu-api';

export interface StaffCategory extends Category {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMenuItem extends MenuItem {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DishFilters {
  search: string;
  /** 'active' = on the menu, 'removed' = taken off the menu */
  show: 'all' | 'active' | 'removed';
  page: number;
}

export interface CreateDishInput {
  categoryId: string;
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export type UpdateDishInput = Partial<{
  categoryId: string;
  name: string;
  price: string;
  description: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
}>;

export type UpdateCategoryInput = Partial<{
  name: string;
  description: string | null;
  isActive: boolean;
}>;

const keys = {
  categories: ['staff-categories'] as const,
  dishes: ['staff-menu-items'] as const,
};

/** After any change, refresh both the staff lists and the public menu customers see. */
function useInvalidateMenu() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.categories }),
      queryClient.invalidateQueries({ queryKey: keys.dishes }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-items'] }),
    ]);
}

export function useStaffCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: ({ signal }) => apiRequest<StaffCategory[]>('/staff/categories', { signal }),
  });
}

export function useStaffDishes({ search, show, page }: DishFilters) {
  return useQuery({
    queryKey: [...keys.dishes, { search, show, page }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search) params.set('search', search);
      if (show !== 'all') params.set('isActive', String(show === 'active'));
      return apiRequest<Page<StaffMenuItem>>(`/staff/menu-items?${params}`, { signal });
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateDish() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: CreateDishInput) =>
      apiRequest<StaffMenuItem>('/staff/menu-items', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateDish() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateDishInput }) =>
      apiRequest<StaffMenuItem>(`/staff/menu-items/${id}`, { method: 'PATCH', body: changes }),
    onSettled: invalidate,
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      apiRequest<StaffCategory>('/staff/categories', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidateMenu();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateCategoryInput }) =>
      apiRequest<StaffCategory>(`/staff/categories/${id}`, { method: 'PATCH', body: changes }),
    onSettled: invalidate,
  });
}
