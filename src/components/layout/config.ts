export type WorkspaceNavItem = {
  label: string;
  href: string;
  /** Rendered only for the workspace owner. */
  ownerOnly?: boolean;
};

export const workspaceNavItems: readonly WorkspaceNavItem[] = [
  { label: "home", href: "/" },
  { label: "dev", href: "/dev", ownerOnly: true },
  { label: "life", href: "/life" },
  { label: "health", href: "/health" },
  { label: "finance", href: "/finance" },
];
