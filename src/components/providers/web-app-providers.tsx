"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ConvexLiveBridge } from "@/components/providers/convex-live-bridge";
import { ConvexSession } from "@/components/providers/convex-session";
import { ThemeProvider } from "@/components/utils/theme-provider";
import { convexClient } from "@/lib/convex-client";
import { createQueryClient } from "@/lib/query/client";

export function WebAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ConvexAuthProvider client={convexClient}>
      <ConvexSession>
        <QueryClientProvider client={queryClient}>
          <ConvexLiveBridge />
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
