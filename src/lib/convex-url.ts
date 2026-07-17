/** Single source for the Convex deployment URL used by browser and server. */
export const convexDeploymentUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? "http://127.0.0.1:3210";
