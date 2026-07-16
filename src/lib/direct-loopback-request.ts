import { hostnameFromHeader } from "@/lib/request-host";

const LOCAL_HOSTS: Record<string, true> = {
  localhost: true,
  "127.0.0.1": true,
  "::1": true,
  "[::1]": true,
};

function isLoopbackHost(value: string | null): boolean {
  if (!value) return false;
  const host = value.trim().toLowerCase();
  const normalized =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return LOCAL_HOSTS[normalized] === true;
}

function isLoopbackEndpoint(value: string): boolean {
  const endpoint = value.trim();
  if (!endpoint) return false;
  return (
    isLoopbackHost(endpoint) || isLoopbackHost(hostnameFromHeader(endpoint))
  );
}

function isPort(value: string): boolean {
  const port = value.trim();
  if (!/^\d{1,5}$/.test(port)) return false;
  const number = Number(port);
  return number > 0 && number <= 65_535;
}

function isSafeForwardedHeader(name: string, value: string): boolean {
  if (name === "x-forwarded-host") return isLoopbackEndpoint(value);
  if (name === "x-forwarded-for") {
    return value.split(",").every(isLoopbackEndpoint);
  }
  if (name === "x-forwarded-proto") {
    return value
      .split(",")
      .every((entry) => ["http", "https"].includes(entry.trim().toLowerCase()));
  }
  if (name === "x-forwarded-port") {
    return value.split(",").every(isPort);
  }
  if (name !== "forwarded") return false;

  const entries = value.split(",");
  if (!entries.length || entries.some((entry) => !entry.trim())) return false;
  return entries.every((entry) =>
    entry.split(";").every((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return false;
      const key = part.slice(0, separator).trim().toLowerCase();
      let candidate = part.slice(separator + 1).trim();
      if (candidate.startsWith('"') && candidate.endsWith('"')) {
        candidate = candidate.slice(1, -1);
      }
      if (!candidate) return false;
      if (key === "for" || key === "host") {
        return isLoopbackEndpoint(candidate);
      }
      if (key === "proto") {
        return ["http", "https"].includes(candidate.toLowerCase());
      }
      if (key === "port") return isPort(candidate);
      return false;
    }),
  );
}

export function isDirectLoopbackRequest(request: Request): boolean {
  if (!isLoopbackHost(process.env.ANORVIS_WEB_BIND_HOST ?? null)) return false;
  let urlHost: string;
  try {
    urlHost = new URL(request.url).hostname;
  } catch {
    return false;
  }
  if (!isLoopbackHost(urlHost)) return false;

  const hostHeader = request.headers.get("host");
  if (hostHeader !== null && !isLoopbackHost(hostnameFromHeader(hostHeader))) {
    return false;
  }

  for (const [name, value] of request.headers) {
    const lowerName = name.toLowerCase();
    if (lowerName === "forwarded" || lowerName.startsWith("x-forwarded-")) {
      if (!isSafeForwardedHeader(lowerName, value)) return false;
    }
  }
  return true;
}
