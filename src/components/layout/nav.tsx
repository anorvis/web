"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anorvis/ui/dropdown-menu";
import { workspacePageStyles, workspaceStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Globe2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ModeToggle } from "@/components/utils/dark-mode-toggle";
import { useHealthStore } from "@/features/health/stores/health-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { prefetchRouteData } from "@/lib/query/preloads";
import { workspaceNavItems } from "./config";

const isActiveLink = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
};

export function WorkspaceNav() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { unitSystem, hydrateUnitSystem, setUnitSystem } = useHealthStore();
  const [mounted, setMounted] = useState(false);

  useMountEffect(() => {
    hydrateUnitSystem();
    setMounted(true);
  });

  const prefetch = (href: string) => {
    router.prefetch(href);
    prefetchRouteData(queryClient, href);
  };

  return (
    <header className={workspaceStyles.nav}>
      <div className="space-y-2">
        <p className={workspaceStyles.navTitle}>{"// life console"}</p>
        <nav className={workspaceStyles.navLinks}>
          {workspaceNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onPointerEnter={() => prefetch(item.href)}
              onFocus={() => prefetch(item.href)}
              className={cn(
                workspaceStyles.navLink,
                isActiveLink(pathname, item.href) &&
                  workspaceStyles.navLinkActive,
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className={workspaceStyles.navActions}>
        {mounted ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${workspaceStyles.navLink} inline-flex items-center gap-2`}
              >
                units
                {unitSystem === "imperial" ? (
                  <span role="img" aria-label="American units">
                    🇺🇸
                  </span>
                ) : (
                  <Globe2 className="h-3 w-3" aria-label="Metric units" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={workspacePageStyles.dropdownContent}
            >
              <DropdownMenuItem
                onClick={() => setUnitSystem("metric")}
                className={workspacePageStyles.dropdownAction}
              >
                metric
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setUnitSystem("imperial")}
                className={workspacePageStyles.dropdownAction}
              >
                imperial
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button type="button" className={workspaceStyles.navLink} disabled>
            units
            <Globe2 className="ml-2 inline h-3 w-3" aria-label="Metric units" />
          </button>
        )}
        <Link
          href="/chat"
          prefetch
          onPointerEnter={() => prefetch("/chat")}
          onFocus={() => prefetch("/chat")}
          className={cn(
            workspaceStyles.navLink,
            isActiveLink(pathname, "/chat") && workspaceStyles.navLinkActive,
          )}
        >
          chat
        </Link>
        <ModeToggle className={workspaceStyles.iconButton} />
      </div>
    </header>
  );
}
