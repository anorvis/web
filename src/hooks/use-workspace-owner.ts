"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { convexApi } from "@/lib/convex-functions";

export type WorkspaceOwnership = {
  /** True once the viewer role has actually been resolved from Convex. */
  resolved: boolean;
  /** Fail closed: false until a verified "owner" role arrives. */
  isOwner: boolean;
};

/**
 * Resolves whether the signed-in session belongs to the workspace owner via
 * the `platform/workspace:viewer` query. While signed out or still loading,
 * both flags stay false so owner-only surfaces never flash for other roles.
 */
export function useWorkspaceOwner(): WorkspaceOwnership {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(
    convexApi.workspaces.viewer,
    isAuthenticated ? {} : "skip",
  );
  if (!isAuthenticated || viewer === undefined) {
    return { resolved: false, isOwner: false };
  }
  return { resolved: true, isOwner: viewer?.role === "owner" };
}
