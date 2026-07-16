import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rejectUnsafeLocalMutation } from "./local-mutation-guard";

const originalBindHost = process.env.ANORVIS_WEB_BIND_HOST;

function mutation(headers: Record<string, string>) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/settings", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", ...headers },
    body: JSON.stringify({ enabled: true }),
  });
}

describe("rejectUnsafeLocalMutation", () => {
  beforeEach(() => {
    process.env.ANORVIS_WEB_BIND_HOST = "127.0.0.1";
  });

  afterEach(() => {
    if (originalBindHost === undefined) {
      delete process.env.ANORVIS_WEB_BIND_HOST;
    } else {
      process.env.ANORVIS_WEB_BIND_HOST = originalBindHost;
    }
  });

  it("accepts a same-origin loopback JSON mutation", () => {
    expect(
      rejectUnsafeLocalMutation(
        mutation({
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
        }),
      ),
    ).toBeNull();
  });

  it("accepts application/json with a charset parameter", () => {
    expect(
      rejectUnsafeLocalMutation(
        mutation({
          origin: "http://localhost:3000",
          "content-type": "application/json; charset=utf-8",
        }),
      ),
    ).toBeNull();
  });

  it("rejects a missing Origin header", async () => {
    const response = rejectUnsafeLocalMutation(
      mutation({ "content-type": "application/json" }),
    );
    expect(response?.status).toBe(403);
  });

  it("rejects a foreign Origin", async () => {
    const response = rejectUnsafeLocalMutation(
      mutation({
        origin: "https://evil.example",
        "content-type": "application/json",
      }),
    );
    expect(response?.status).toBe(403);
  });

  it("rejects CORS-simple text/plain bodies", () => {
    const response = rejectUnsafeLocalMutation(
      mutation({
        origin: "http://127.0.0.1:3000",
        "content-type": "text/plain;charset=UTF-8",
      }),
    );
    expect(response?.status).toBe(415);
  });

  it("rejects mutations when the process is not bound to loopback", () => {
    delete process.env.ANORVIS_WEB_BIND_HOST;
    const response = rejectUnsafeLocalMutation(
      mutation({
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      }),
    );
    expect(response?.status).toBe(403);
  });
});
