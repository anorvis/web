import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workspaceNavItems } from "./config";
import { WorkspaceNav } from "./nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ prefetch: () => {} }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

const ownership = vi.hoisted(() => ({ resolved: false, isOwner: false }));

vi.mock("@/hooks/use-workspace-owner", () => ({
  useWorkspaceOwner: () => ({ ...ownership }),
}));

function renderNav() {
  const client = new QueryClient();
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(WorkspaceNav)),
  );
}

function renderedHrefs(html: string) {
  return Array.from(html.matchAll(/<a href="([^"]*)"/g), (m) => m[1]);
}

describe("workspace nav", () => {
  it("orders the nav config home, dev, life, health, finance", () => {
    expect(workspaceNavItems.map((item) => item.label)).toEqual([
      "home",
      "dev",
      "life",
      "health",
      "finance",
    ]);
  });

  it("marks only dev as owner-only", () => {
    expect(
      workspaceNavItems.filter((item) => item.ownerOnly).map((i) => i.href),
    ).toEqual(["/dev"]);
  });

  it("renders dev immediately right of home for the owner", () => {
    ownership.resolved = true;
    ownership.isOwner = true;
    expect(renderedHrefs(renderNav())).toEqual([
      "/",
      "/dev",
      "/life",
      "/health",
      "/finance",
    ]);
  });

  it("hides dev from non-owner sessions", () => {
    ownership.resolved = true;
    ownership.isOwner = false;
    expect(renderedHrefs(renderNav())).toEqual([
      "/",
      "/life",
      "/health",
      "/finance",
    ]);
  });

  it("hides dev while the viewer role is still unresolved (fail closed)", () => {
    ownership.resolved = false;
    ownership.isOwner = false;
    expect(renderedHrefs(renderNav())).not.toContain("/dev");
  });
});
