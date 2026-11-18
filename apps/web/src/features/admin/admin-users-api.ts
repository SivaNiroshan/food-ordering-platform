import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Page, User, UserRole } from '../../lib/types';

export interface UserFilters {
  search: string;
  role?: UserRole;
  status?: 'active' | 'deactivated';
  page: number;
}

const usersKey = ['admin-users'] as const;

export function useAdminUsers({ search, role, status, page }: UserFilters) {
  return useQuery({
    queryKey: [...usersKey, { search, role, status, page }],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      if (status) params.set('isActive', String(status === 'active'));
      return apiRequest<Page<User>>(`/admin/users?${params}`, { signal });
    },
    placeholderData: keepPreviousData,
  });
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: 'STAFF' | 'ADMIN';
}

export function useCreateStaffUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) =>
      apiRequest<User>('/admin/users', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiRequest<User>(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useChangeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest<User>(`/admin/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}
