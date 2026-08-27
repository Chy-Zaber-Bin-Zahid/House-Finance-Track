"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

/**
 * One client per browser, created inside the component rather than at module
 * scope. A module-level client is shared across requests on the server, which
 * in a multi-account app means one person's cached data reaching another.
 *
 * staleTime is deliberately non-zero: at zero, every hydrated query refetches
 * immediately, doubling requests for nothing.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [client] = useState(
    () =>
      new QueryClient({
        /*
         * The cookie survives a session that was expired, rejected, or ended by
         * a password change, so the optimistic redirect in proxy.ts lets the
         * user through to screens that then refuse every read. Send them to
         * sign in rather than leaving them on an error with no way forward.
         */
        queryCache: new QueryCache({
          onError: (error) => {
            if (error instanceof ApiError && error.status === 401 && !pathname.startsWith("/sign-in")) {
              router.push("/sign-in");
            }
          },
        }),
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
