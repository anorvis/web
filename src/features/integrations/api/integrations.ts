import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

type Provider = "google" | "pinterest" | "hevy" | "snaptrade";

function pathProvider(path: string): Provider | null {
  if (path.startsWith("/api/integrations/google/")) return "google";
  if (path.startsWith("/api/integrations/pinterest/")) return "pinterest";
  if (path.startsWith("/api/integrations/hevy/")) return "hevy";
  if (path.startsWith("/api/integrations/snaptrade/")) return "snaptrade";
  return null;
}

function unsupported(path: string): Error {
  return new Error(`Integration route is not backed by Convex: ${path}`);
}

export function fetchIntegrationSettings<T>(path: string): Promise<T> {
  const provider = pathProvider(path);
  if (provider === "google") {
    return convexClient.action(convexApi.google.settings, {}) as Promise<T>;
  }
  if (provider === "pinterest") {
    return convexClient.action(convexApi.pinterest.settings, {}) as Promise<T>;
  }
  if (provider === "hevy") {
    return convexClient.action(convexApi.hevy.settings, {}) as Promise<T>;
  }
  if (provider === "snaptrade") {
    return convexClient.action(convexApi.snaptrade.settings, {}) as Promise<T>;
  }
  return Promise.reject(unsupported(path));
}

export function saveIntegrationSettings<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const provider = pathProvider(path);
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  if (provider === "google") {
    return convexClient.action(
      convexApi.google.saveSettings,
      input,
    ) as Promise<T>;
  }
  if (provider === "pinterest") {
    return convexClient.action(
      convexApi.pinterest.saveSettings,
      input,
    ) as Promise<T>;
  }
  if (provider === "hevy") {
    return convexClient.action(
      convexApi.hevy.saveSettings,
      input,
    ) as Promise<T>;
  }
  if (provider === "snaptrade") {
    return convexClient.action(
      convexApi.snaptrade.saveSettings,
      input,
    ) as Promise<T>;
  }
  return Promise.reject(unsupported(path));
}

export function postIntegrationAction<T>(path: string): Promise<T> {
  if (path === "/api/integrations/hevy/sync") {
    return convexClient.action(convexApi.hevy.syncNow, {}) as Promise<T>;
  }
  const disconnect = path.match(/^\/api\/integrations\/([^/]+)\/disconnect$/);
  if (disconnect) {
    const provider = disconnect[1];
    if (
      provider === "google" ||
      provider === "pinterest" ||
      provider === "hevy" ||
      provider === "snaptrade"
    ) {
      return convexClient.mutation(convexApi.integrations.disconnect, {
        provider,
      }) as Promise<T>;
    }
  }
  return Promise.reject(unsupported(path));
}

export function deleteIntegrationAction<T>(
  path: string,
  _body: unknown,
): Promise<T> {
  return Promise.reject(unsupported(path));
}

export function saveIntegrationToken(input: {
  provider: string;
  token: string;
}): Promise<unknown> {
  if (input.provider !== "hevy") {
    return Promise.reject(unsupported(`/api/integrations/${input.provider}`));
  }
  return convexClient.action(convexApi.hevy.saveSettings, {
    apiKey: input.token,
  });
}

export function startGoogleOAuth(input: {
  clientId: string;
  clientSecret: string;
  returnTo?: string;
}): Promise<{ authorizationUrl: string }> {
  const origin = window.location.origin;
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
  return convexClient.action(convexApi.google.start, {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: `${site}/oauth/google/callback`,
    returnTo: input.returnTo ?? `${origin}/`,
  }) as Promise<{ authorizationUrl: string }>;
}

export function startPinterestOAuth(input: {
  clientId: string;
  clientSecret: string;
  returnTo?: string;
}): Promise<{ authorizationUrl: string }> {
  const origin = window.location.origin;
  const site =
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
  return convexClient.action(convexApi.pinterest.start, {
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    redirectUri: `${site}/oauth/pinterest/callback`,
    returnTo: input.returnTo ?? `${origin}/`,
  }) as Promise<{ authorizationUrl: string }>;
}
