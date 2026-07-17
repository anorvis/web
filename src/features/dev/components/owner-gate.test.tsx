import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevOwnerGate } from "./owner-gate";

const ownership = vi.hoisted(() => ({ resolved: false, isOwner: false }));
const auth = vi.hoisted<{ token: string | null }>(() => ({
  token: "jwt-123",
}));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const setDevSessionToken = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-workspace-owner", () => ({
  useWorkspaceOwner: () => ({ ...ownership }),
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthToken: () => auth.token,
}));
vi.mock("@/features/dev/api/session-token", () => ({ setDevSessionToken }));

function renderGate() {
  return renderToStaticMarkup(
    createElement(DevOwnerGate, null, createElement("p", null, "DEV_CONTENT")),
  );
}

describe("DevOwnerGate", () => {
  beforeEach(() => {
    notFound.mockClear();
    setDevSessionToken.mockClear();
    auth.token = "jwt-123";
  });

  it("renders nothing until the role resolves", () => {
    ownership.resolved = false;
    ownership.isOwner = false;
    expect(renderGate()).toBe("");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("waits for the bearer token before mounting owner content", () => {
    ownership.resolved = true;
    ownership.isOwner = true;
    auth.token = null;
    expect(renderGate()).toBe("");
    expect(setDevSessionToken).toHaveBeenCalledWith(null);
  });

  it("404s for non-owner sessions", () => {
    ownership.resolved = true;
    ownership.isOwner = false;
    expect(renderGate).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders dev content for the owner and mirrors the session token", () => {
    ownership.resolved = true;
    ownership.isOwner = true;
    const html = renderGate();
    expect(html).toContain("DEV_CONTENT");
    expect(setDevSessionToken).toHaveBeenCalledWith("jwt-123");
  });
});
