import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
