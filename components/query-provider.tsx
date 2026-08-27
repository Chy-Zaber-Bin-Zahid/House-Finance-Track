"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * One client per browser, created inside the component rather than at module
 * scope. A module-level client is shared across requests on the server, which
 * in a multi-account app means one person's cached data reaching another.
 *
 * staleTime is deliberately non-zero: at zero, every hydrated query refetches
 * immediately, doubling requests for nothing.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
