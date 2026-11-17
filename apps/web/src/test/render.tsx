import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

/**
 * Renders a page with the providers it needs (React Query + a router).
 * Any route other than `path` renders "Navigated to <path>", so tests can check redirects.
 */
export function renderPage(
  ui: ReactElement,
  { path = '/', route }: { path?: string; route?: string } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path, element: ui },
      { path: '*', element: <NavigatedTo /> },
    ],
    { initialEntries: [route ?? path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

function NavigatedTo() {
  const location = useLocation();
  return <p>Navigated to {location.pathname}</p>;
}