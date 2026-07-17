/**
 * Bridge between the React auth context and the plain fetch helpers in
 * `dev.ts`: the owner gate mirrors the current Convex session JWT here so
 * every /api/dev request can attach it for the server-side owner guard.
 */
let sessionToken: string | null = null;

export function setDevSessionToken(token: string | null): void {
  sessionToken = token;
}

/** Authorization headers for /api/dev requests; empty when signed out. */
export function devAuthHeaders(): Record<string, string> {
  return sessionToken ? { authorization: `Bearer ${sessionToken}` } : {};
}
