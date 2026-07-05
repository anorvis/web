"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ThemeProvider } from "@/components/utils/theme-provider";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createQueryClient } from "@/lib/query/client";
import {
  restorePersistedQueryCache,
  subscribePersistedQueryCache,
} from "@/lib/query/persistence";
import { AppDataPreloader } from "./app-data-preloader";
import { AppQueryEvents } from "./app-query-events";

export function WebAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  useMountEffect(() => {
    restorePersistedQueryCache(queryClient);
    return subscribePersistedQueryCache(queryClient);
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AppQueryEvents />
        <AppDataPreloader />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
