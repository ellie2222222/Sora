import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { isUnauthenticated } from '../../utils/errors.ts';

/**
 * One client per app instance, created inside the component so React Fast
 * Refresh does not spawn a second cache that silently stops receiving
 * invalidations from the first.
 */
export function QueryProvider({ children }: { children: ReactNode }): ReactNode {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              // A 401 means the interceptor's single-flight refresh already
              // failed; retrying the query cannot succeed and only delays
              // routing the user to login.
              if (isUnauthenticated(error)) return false;
              return failureCount < 2;
            },
            staleTime: 30_000,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
