import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { restoreSession } from '../features/auth/auth-api';
import { ApiError } from '../lib/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 4xx (bad input, not found, forbidden) never helps; retry network/5xx once.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 1,
    },
    mutations: {
      // React Query's default ("online") PAUSES a mutation while the browser is offline and
      // sends it later by itself. For actions like placing or cancelling an order, the user
      // should decide when to retry, so we send the request anyway and show the error at once.
      networkMode: 'always',
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void restoreSession();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
