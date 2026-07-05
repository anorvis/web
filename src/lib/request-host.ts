export function hostnameFromHeader(value: string | null) {
  if (!value) return null;

  try {
    return new URL(
      value.includes("://") ? value : `http://${value}`,
    ).hostname.toLowerCase();
  } catch {
    return value.split(":")[0]?.toLowerCase() ?? null;
  }
}
