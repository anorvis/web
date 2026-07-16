"use client";

import { Button } from "@anorvis/ui/button";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={workspacePageStyles.metricCell}>
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <p className={workspacePageStyles.metricValue}>{value}</p>
    </div>
  );
}

export const DEV_PAGE_SIZE = 20;

export type Pager = {
  page: number;
  pageCount: number;
  total: number;
  setPage: (page: number) => void;
};

/** Clamp a page index against a total so stale pages never render empty. */
export function pageBounds(page: number, total: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return { pageCount, page: Math.min(Math.max(page, 0), pageCount - 1) };
}

export function usePagedItems<T>(
  items: readonly T[],
  pageSize: number = DEV_PAGE_SIZE,
): { pageItems: readonly T[]; pager: Pager } {
  const [rawPage, setPage] = useState(0);
  const { page, pageCount } = pageBounds(rawPage, items.length, pageSize);
  return {
    pageItems: items.slice(page * pageSize, page * pageSize + pageSize),
    pager: { page, pageCount, total: items.length, setPage },
  };
}

export function PagerControls({
  pager,
  label,
}: {
  pager: Pager;
  label: string;
}) {
  const { page, pageCount, total, setPage } = pager;
  return (
    <nav
      className="flex items-center justify-between gap-2 pt-2"
      aria-label={`${label} pagination`}
    >
      <span className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
        {total} total
      </span>
      {pageCount > 1 ? (
        <span className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            prev
          </Button>
          <span className="text-[0.55rem] text-muted-foreground">
            {page + 1}/{pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            next
          </Button>
        </span>
      ) : null}
    </nav>
  );
}
