import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageSpinner } from '../../components/ui/Spinner';
import type { UserRole } from '../../lib/types';
import { useAuthStore } from './auth-store';
import { HOME_BY_ROLE } from './roles';
import { ServerUnreachable } from './ServerUnreachable';

/**
 * Guards a route on the client. This is only for user experience: the API enforces
 * the same rules, so hiding a page here is never the security boundary.
 */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === 'unknown') return <FullPageSpinner />;
  if (status === 'unreachable') return <ServerUnreachable />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  }

  return children;
}

/** For /login and /register: logged-in users go straight to their home page. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'unknown') return <FullPageSpinner />;
  if (status === 'unreachable') return <ServerUnreachable standalone />;
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return children;
}

/** The "/" route: send everyone to the right starting page. */
export function HomeRedirect() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === 'unknown') return <FullPageSpinner />;
  if (status === 'unreachable') return <ServerUnreachable standalone />;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/menu'} replace />;
}
