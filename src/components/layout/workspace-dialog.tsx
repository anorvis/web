"use client";

import { Dialog, DialogContent } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";

export function WorkspaceDialog({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className ?? workspacePageStyles.dialogContent}>
        {children}
      </DialogContent>
    </Dialog>
  );
}
