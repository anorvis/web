"use client";

import type { CSSProperties, ReactNode } from "react";

export { WorkspaceCard } from "@anorvis/ui/workspace-card";

export function WorkspaceMetricButton({
  label,
  value,
  note,
  onClick,
  action,
  valueStyle,
  noteStyle,
}: {
  label: string;
  value: string;
  note?: string;
  onClick: () => void;
  action?: ReactNode;
  valueStyle?: CSSProperties;
  noteStyle?: CSSProperties;
}) {
  return (
    <div className="relative min-h-28 border border-border transition hover:border-foreground hover:bg-foreground/[0.03]">
      <button
        type="button"
        onClick={onClick}
        className="h-full min-h-28 w-full p-3 text-left"
      >
        <p className="pr-10 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p
          className="mt-1 text-lg leading-none tracking-[0.04em] text-foreground"
          style={valueStyle}
        >
          {value}
        </p>
        {note && (
          <p className="mt-2 text-xs text-muted-foreground" style={noteStyle}>
            {note}
          </p>
        )}
      </button>
      {action && <div className="absolute right-3 top-3">{action}</div>}
    </div>
  );
}
