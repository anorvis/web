"use client";

import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/shell";

export function Workspace({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
