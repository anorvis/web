"use client";

import { workspaceStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";
import { WorkspaceNav } from "@/components/layout/nav";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className={workspaceStyles.shell}>
      <div className={workspaceStyles.navContainer}>
        <WorkspaceNav />
      </div>
      {children}
    </div>
  );
}
