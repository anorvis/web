export type AnorvisRuntime = "local" | "prod";

export function getAnorvisRuntime(): AnorvisRuntime {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv && vercelEnv !== "development" ? "prod" : "local";
}

export function isAnorvisProdRuntime(): boolean {
  return getAnorvisRuntime() === "prod";
}
