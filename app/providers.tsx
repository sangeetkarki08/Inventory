'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { OfflineProvider } from '@/lib/offline/offline-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // While offline, retries against an unreachable server just delay
            // failure — let the offline layer take over instead.
            retry: (failureCount, error) => {
              if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
              return failureCount < 2 && !!error;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <OfflineProvider>{children}</OfflineProvider>
    </QueryClientProvider>
  );
}
