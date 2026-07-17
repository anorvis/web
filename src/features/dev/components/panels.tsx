"use client";

import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { workspacePageStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";
import { useState } from "react";

/** Wide detail modal, matching the life/health/finance dialog sizing. */
export const devModalClass =
  "max-h-[84vh] w-[min(94vw,64rem)] max-w-none overflow-hidden p-0 sm:!max-w-none";

/**
 * Clickable summary card that opens a detail modal, mirroring the
 * integrations-card pattern: the whole card reacts to pointer clicks while
 * the header button carries the keyboard/ARIA path.
 */
export function DetailCard({
  label,
  title,
  onOpen,
  children,
}: {
  label: string;
  title: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      className={`${workspacePageStyles.card} cursor-pointer transition hover:border-foreground`}
      onClick={onOpen}
    >
      <CardHeader className={workspacePageStyles.cardHeader}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className={workspacePageStyles.cardLabel}>{label}</p>
            <h2 className={workspacePageStyles.cardTitle}>{title}</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={workspacePageStyles.actionButton}
            aria-haspopup="dialog"
            aria-label={`open ${title} detail`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            detail
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-5 py-4">
        {children}
      </CardContent>
    </Card>
  );
}

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
