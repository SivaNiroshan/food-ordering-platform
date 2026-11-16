import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/AppShell';
import { NotFoundPage } from '../components/layout/NotFoundPage';
import { PlaceholderPage } from '../components/layout/PlaceholderPage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { GuestOnly, HomeRedirect, RequireAuth } from '../features/auth/RequireAuth';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>
    ),
  },
  {
    element: <AppShell />,
    children: [
      // The menu is public: anyone can browse; ordering needs an account.
      { path: '/menu', element: <PlaceholderPage title="Menu" phase="5B" /> },
      {
        path: '/orders',
        element: (
          <RequireAuth roles={['CUSTOMER']}>
            <PlaceholderPage title="My orders" phase="5C" />
          </RequireAuth>
        ),
      },
      {
        path: '/kitchen',
        element: (
          <RequireAuth roles={['STAFF', 'ADMIN']}>
            <PlaceholderPage title="Kitchen" phase="5D" />
          </RequireAuth>
        ),
      },
      {
        path: '/admin/users',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <PlaceholderPage title="Users" phase="5E" />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
