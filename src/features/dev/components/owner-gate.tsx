"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { setDevSessionToken } from "@/features/dev/api/session-token";
import { useWorkspaceOwner } from "@/hooks/use-workspace-owner";

/**
 * Fail-closed owner gate for the complete /dev surface. Nothing renders until
 * both the owner role and bearer token resolve, so the page cannot flash for
 * another role and child queries cannot race the token mirror.
 */
export function DevOwnerGate({ children }: { children: ReactNode }) {
  const { resolved, isOwner } = useWorkspaceOwner();
  const token = useAuthToken();
  setDevSessionToken(token ?? null);

  if (!resolved || !token) return null;
  if (!isOwner) notFound();
  return <>{children}</>;
}
