"use client";

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import type { ReactNode } from "react";

export const workspaceModalFooterClass =
  "sticky bottom-0 -mx-5 -mb-5 mt-auto flex min-h-11 items-center justify-end gap-2 border-t border-border bg-background px-5 py-2";
export const workspacePinnedModalFooterClass =
  "sticky bottom-0 -mx-5 mt-auto flex min-h-11 items-center justify-end gap-2 border-t border-border bg-background px-5 py-2";

export function WorkspaceDialog({
  open,
  onOpenChange,
  children,
  className,
  showCloseButton = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      {open && (
        <DialogPortal>
          <DialogOverlay forceMount />
        </DialogPortal>
      )}
      <DialogContent
        className={cn(workspacePageStyles.dialogContent, className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
