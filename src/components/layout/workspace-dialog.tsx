"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import type { ReactNode } from "react";

export const workspaceModalFooterClass =
  "sticky bottom-0 -mx-5 -mb-5 mt-auto flex min-h-11 items-center justify-end gap-2 border-t border-border bg-background px-5 py-2";
export const workspacePinnedModalFooterClass =
  "sticky bottom-0 -mx-5 mt-auto flex min-h-11 items-center justify-end gap-2 border-t border-border bg-background px-5 py-2";

export function WorkspaceModalFrame({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-h-[84vh] min-h-[38rem] w-full min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className={workspacePageStyles.cardTitle}>
          {title}
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          {description}
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-0">
        {children}
      </div>
    </div>
  );
}

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
      <DialogPortal>
        <DialogOverlay />
      </DialogPortal>
      <DialogContent
        className={cn(workspacePageStyles.dialogContent, className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
