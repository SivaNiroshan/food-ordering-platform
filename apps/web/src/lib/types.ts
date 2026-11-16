// Shapes returned by the API (see docs/api-contract.md).

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
