import { beforeEach, describe, expect, it, vi } from "vitest";
import { rejectNonOwnerSession } from "./dev-owner-guard";

const { query, setAuth } = vi.hoisted(() => ({
  query: vi.fn(),
  setAuth: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = setAuth;
    query = query;
  },
}));

function request(headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/status", {
    headers: { host: "127.0.0.1:3000", ...headers },
  });
}

describe("rejectNonOwnerSession", () => {
  beforeEach(() => {
    query.mockReset();
    setAuth.mockReset();
  });

  it("rejects a request without a session token before querying Convex", async () => {
    const denied = await rejectNonOwnerSession(request());
    expect(denied?.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization headers", async () => {
    const denied = await rejectNonOwnerSession(
      request({ authorization: "Token abc" }),
    );
    expect(denied?.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it("admits a session whose viewer role is owner", async () => {
    query.mockResolvedValue({ role: "owner" });
    const denied = await rejectNonOwnerSession(
      request({ authorization: "Bearer jwt-123" }),
    );
    expect(denied).toBeNull();
    expect(setAuth).toHaveBeenCalledWith("jwt-123");
  });

  it("rejects non-owner roles", async () => {
    query.mockResolvedValue({ role: "member" });
    const denied = await rejectNonOwnerSession(
      request({ authorization: "Bearer jwt-123" }),
    );
    expect(denied?.status).toBe(403);
  });

  it("fails closed when the viewer payload carries no role", async () => {
    query.mockResolvedValue(null);
    const denied = await rejectNonOwnerSession(
      request({ authorization: "Bearer jwt-123" }),
    );
    expect(denied?.status).toBe(403);
  });

  it("fails closed when the viewer query throws", async () => {
    query.mockRejectedValue(new Error("unauthenticated"));
    const denied = await rejectNonOwnerSession(
      request({ authorization: "Bearer jwt-123" }),
    );
    expect(denied?.status).toBe(403);
  });
});
