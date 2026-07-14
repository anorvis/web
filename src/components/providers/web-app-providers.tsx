"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ConvexSession } from "@/components/providers/convex-session";
import { ThemeProvider } from "@/components/utils/theme-provider";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { convexClient } from "@/lib/convex-client";
import { createQueryClient } from "@/lib/query/client";
import {
  restorePersistedQueryCache,
  subscribePersistedQueryCache,
} from "@/lib/query/persistence";

export function WebAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  useMountEffect(() => {
    restorePersistedQueryCache(queryClient);
    return subscribePersistedQueryCache(queryClient);
  });

  return (
    <ConvexAuthProvider client={convexClient}>
      <ConvexSession>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </ConvexSession>
    </ConvexAuthProvider>
  );
}
