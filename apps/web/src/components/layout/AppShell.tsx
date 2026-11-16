import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { logout } from '../../features/auth/auth-api';
import { useAuthStore } from '../../features/auth/auth-store';
import { cn } from '../../lib/cn';
import type { UserRole } from '../../lib/types';
import { Button } from '../ui/Button';
import { Wordmark } from './Wordmark';

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<UserRole | 'GUEST', NavItem[]> = {
  GUEST: [{ to: '/menu', label: 'Menu' }],
  CUSTOMER: [
    { to: '/menu', label: 'Menu' },
    { to: '/orders', label: 'My orders' },
  ],
  STAFF: [{ to: '/kitchen', label: 'Kitchen' }],
  ADMIN: [
    { to: '/kitchen', label: 'Orders' },
    { to: '/admin/users', label: 'Users' },
  ],
};

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-leaf-50 text-leaf-700' : 'text-ash hover:text-ink',
  );
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const items = NAV_BY_ROLE[user?.role ?? 'GUEST'];

  async function handleLogout() {
    setLoggingOut(true);
    await logout().catch(() => undefined);
    setLoggingOut(false);
    navigate('/login');
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-coconut/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-ash sm:inline">{user.name}</span>
                <Button variant="ghost" onClick={handleLogout} loading={loggingOut}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Log in
                </NavLink>
                <NavLink
                  to="/register"
                  className="rounded-lg bg-leaf-700 px-3 py-2 text-sm font-medium text-white hover:bg-leaf-800"
                >
                  Create account
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
