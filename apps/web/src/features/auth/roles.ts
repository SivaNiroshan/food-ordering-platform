import type { UserRole } from '../../lib/types';

/** Where each role lands after logging in. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  CUSTOMER: '/menu',
  STAFF: '/kitchen',
  ADMIN: '/admin/users',
};
