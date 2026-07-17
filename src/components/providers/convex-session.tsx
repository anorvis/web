"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { type ReactNode, useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { convexApi } from "@/lib/convex-functions";

const INITIAL_RETRY_MS = 250;
const MAX_RETRY_MS = 5_000;

/**
 * Retries an automatic local startup step without ever surfacing an
 * interstitial. The returned cleanup cancels scheduled work and suppresses a
 * late success callback after unmount.
 */
export function startSilentRetry(
  task: () => Promise<boolean>,
  onSuccess: () => void = () => {},
): () => void {
  let stopped = false;
  let delay = INITIAL_RETRY_MS;

  const attempt = async () => {
    let complete = false;
    try {
      complete = await task();
    } catch {
      complete = false;
    }
    if (stopped) return;
    if (complete) {
      onSuccess();
      return;
    }
    globalThis.setTimeout(() => {
      if (!stopped) void attempt();
    }, delay);
    delay = Math.min(delay * 2, MAX_RETRY_MS);
  };

  void attempt();
  return () => {
    stopped = true;
  };
}

async function signInWithLocalKey(
  signIn: (
    provider: string,
    params?: FormData | { key: string },
  ) => Promise<unknown>,
): Promise<boolean> {
  try {
    const response = await fetch("/api/local-key", { cache: "no-store" });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("key" in body) ||
      typeof body.key !== "string" ||
      !body.key
    ) {
      return false;
    }
    await signIn("local-key", { key: body.key });
    return true;
  } catch {
    return false;
  }
}

function WorkspaceBootstrap({ children }: { children: ReactNode }) {
  const ensureDefault = useMutation(convexApi.workspaces.ensureDefault);
  const [ready, setReady] = useState(false);

  useMountEffect(() =>
    startSilentRetry(
      async () => {
        await ensureDefault({});
        return true;
      },
      () => setReady(true),
    ),
  );

  return ready ? children : null;
}
export function ConvexSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  useMountEffect(() => {
    if (isAuthenticated) return;
    return startSilentRetry(() => signInWithLocalKey(signIn));
  });

  if (isLoading || !isAuthenticated) return null;
  return <WorkspaceBootstrap>{children}</WorkspaceBootstrap>;
}
