import type { ReactNode } from "react";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
} from "@/components/layout/workspace-dialog";
import { devModalClass, Metric } from "@/features/dev/components/panels";

export function UsageDetailMetrics({
  items,
}: {
  items: readonly { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Metric key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

export function UsageAnalyticsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      className={devModalClass}
    >
      <WorkspaceModalFrame
        title={title}
        description={description}
        className="min-h-0"
      >
        <div className="space-y-4 py-4">{children}</div>
      </WorkspaceModalFrame>
    </WorkspaceDialog>
  );
}
