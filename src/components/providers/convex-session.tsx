"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { type FormEvent, type ReactNode, useState } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { convexApi } from "@/lib/convex-functions";

function WorkspaceBootstrap({ children }: { children: ReactNode }) {
  const ensureDefault = useMutation(convexApi.workspaces.ensureDefault);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useMountEffect(() => {
    ensureDefault({})
      .then(() => setReady(true))
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Workspace setup failed",
        ),
      );
  });
  if (error) {
    return (
      <main className="grid min-h-screen place-items-center text-destructive">
        {error}
      </main>
    );
  }
  return ready ? (
    children
  ) : (
    <main className="grid min-h-screen place-items-center">
      opening local workspace…
    </main>
  );
}
export function ConvexSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center">
        loading local workspace…
      </main>
    );
  }
  if (isAuthenticated)
    return <WorkspaceBootstrap>{children}</WorkspaceBootstrap>;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("flow", flow);
    try {
      await signIn("password", form);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border p-6"
        onSubmit={submit}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Anorvis local
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {flow === "signIn" ? "unlock workspace" : "create owner"}
          </h1>
        </div>
        <label className="block space-y-2 text-sm">
          <span>email</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>password</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            name="password"
            type="password"
            autoComplete={
              flow === "signIn" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />
        </label>
        {flow === "signUp" ? (
          <>
            <label className="block space-y-2 text-sm">
              <span>name</span>
              <input
                className="w-full rounded-md border bg-background px-3 py-2"
                name="name"
                autoComplete="name"
                required
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span>setup key</span>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 font-mono"
                name="setupKey"
                type="password"
                autoComplete="off"
                required
              />
            </label>
          </>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          className="w-full rounded-md bg-foreground px-4 py-2 text-background"
          disabled={submitting}
          type="submit"
        >
          {submitting
            ? "working…"
            : flow === "signIn"
              ? "sign in"
              : "create workspace"}
        </button>
        <button
          className="w-full text-sm text-muted-foreground underline"
          type="button"
          onClick={() =>
            setFlow((value) => (value === "signIn" ? "signUp" : "signIn"))
          }
        >
          {flow === "signIn"
            ? "first run? create the local owner"
            : "already initialized? sign in"}
        </button>
      </form>
    </main>
  );
}
