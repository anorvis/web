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
import { Coins, Globe2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ModeToggle } from "@/components/utils/dark-mode-toggle";
import { useHealthStore } from "@/features/health/stores/health-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { useWorkspaceOwner } from "@/hooks/use-workspace-owner";
import { prefetchRouteData } from "@/lib/query/preloads";
import {
  preferredCurrencies,
  useFinancePreferences,
} from "@/lib/stores/finance-preferences";
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
  const { isOwner } = useWorkspaceOwner();
  const { unitSystem, hydrateUnitSystem, setUnitSystem } = useHealthStore();
  const { preferredCurrency, hydratePreferredCurrency, setPreferredCurrency } =
    useFinancePreferences();
  const [mounted, setMounted] = useState(false);

  useMountEffect(() => {
    hydrateUnitSystem();
    hydratePreferredCurrency();
    setMounted(true);
  });

  const prefetch = (href: string) => {
    router.prefetch(href);
    prefetchRouteData(queryClient, href);
  };

  return (
    <header className={workspaceStyles.nav}>
      <div className="space-y-2">
        <p className={workspaceStyles.navTitle}>{"// console"}</p>
        <nav className={workspaceStyles.navLinks}>
          {workspaceNavItems
            .filter((item) => !item.ownerOnly || isOwner)
            .map((item) => (
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
        {mounted ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${workspaceStyles.navLink} inline-flex items-center gap-2`}
                aria-label={`Preferred currency: ${preferredCurrency}`}
              >
                currency
                <Coins className="h-3 w-3" aria-hidden="true" />
                {preferredCurrency}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={workspacePageStyles.dropdownContent}
            >
              {preferredCurrencies.map((currency) => (
                <DropdownMenuItem
                  key={currency}
                  onClick={() => setPreferredCurrency(currency)}
                  className={workspacePageStyles.dropdownAction}
                >
                  {currency}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            className={workspaceStyles.navLink}
            aria-label="Preferred currency: CAD"
            disabled
          >
            currency
            <Coins className="ml-2 inline h-3 w-3" aria-hidden="true" />
          </button>
        )}
        <ModeToggle className={workspaceStyles.iconButton} />
      </div>
    </header>
  );
}
