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

  it("renders dev immediately right of home with sibling styling", () => {
    const client = new QueryClient();
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(WorkspaceNav),
      ),
    );

    const hrefs = Array.from(html.matchAll(/<a href="([^"]*)"/g), (m) => m[1]);
    expect(hrefs).toEqual(["/", "/dev", "/life", "/health", "/finance"]);
  });
});
