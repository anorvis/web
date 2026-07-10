"use client";

import type { ChartConfig } from "@anorvis/ui/chart";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { Fragment, type ReactNode, useRef, useState } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import { formatCurrencyAmount } from "@/features/finance/components/finance-derive";

const financeModalClass =
  "flex h-[min(84vh,46rem)] w-[min(94vw,54rem)] max-w-none flex-col overflow-hidden p-0 sm:!max-w-none";

export function FinanceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      className={cn(financeModalClass, className)}
    >
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className={workspacePageStyles.cardTitle}>
            {title}
          </DialogTitle>
          <DialogDescription className={workspacePageStyles.cardBodyText}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto px-5 py-4",
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </WorkspaceDialog>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="text-xs text-foreground">{title}</p>
      <p className={workspacePageStyles.cardBodyText}>{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function safePageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

/**
 * Chart tooltip row with breathing room between the series label and its
 * currency-formatted value; the default recharts row renders them flush.
 */
export function currencyTooltipFormatter(
  config: ChartConfig,
  currency: string,
) {
  return (
    value: number | string | Array<number | string>,
    name: number | string,
    item: { color?: string; payload?: { fill?: string } },
  ) => (
    <div className="flex w-full min-w-0 items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: item.payload?.fill ?? item.color }}
        />
        {config[String(name)]?.label ?? String(name)}
      </span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {formatCurrencyAmount(Number(value), currency)}
      </span>
    </div>
  );
}

function financeTabId(label: string, id: string): string {
  return `finance-tab-${label}-${id}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
}

export function financeTabPanelProps(label: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${financeTabId(label, id)}-panel`,
    "aria-labelledby": financeTabId(label, id),
  };
}

export function FinanceTabs({
  label,
  tabs,
  active,
  onSelect,
}: {
  label: string;
  tabs: readonly { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex shrink-0 items-center justify-end gap-2"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={financeTabId(label, tab.id)}
          aria-selected={active === tab.id}
          aria-controls={`${financeTabId(label, tab.id)}-panel`}
          tabIndex={active === tab.id ? 0 : -1}
          className={cn(
            workspacePageStyles.toggleButton,
            "min-w-0 truncate whitespace-nowrap",
            active === tab.id && "border-foreground text-foreground",
          )}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            let nextIndex: number | null = null;
            if (event.key === "ArrowRight")
              nextIndex = (index + 1) % tabs.length;
            if (event.key === "ArrowLeft")
              nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = tabs.length - 1;
            if (nextIndex === null) return;
            event.preventDefault();
            const next = tabs[nextIndex];
            if (!next) return;
            onSelect(next.id);
            refs.current[nextIndex]?.focus();
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function CurrencyChips({
  label,
  currencies,
  active,
  onSelect,
}: {
  label: string;
  currencies: string[];
  active: string | null;
  onSelect: (currency: string) => void;
}) {
  if (currencies.length === 0) return null;
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
        currency
      </span>
      {currencies.map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={active === currency}
          className={cn(
            workspacePageStyles.toggleButton,
            active === currency && "border-foreground text-foreground",
          )}
          onClick={() => onSelect(currency)}
        >
          {currency}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Bounded, page-by-page record list. Renders at most `pageSize` rows at a time
 * with previous/next controls so record-heavy dialogs never dump an unbounded
 * list into the DOM.
 */
export function PaginatedRecords<T>({
  items,
  renderRow,
  keyOf,
  empty,
  pageSize = 12,
  fill = false,
  scroll = true,
  footerClassName,
}: {
  items: T[];
  renderRow: (item: T) => ReactNode;
  keyOf: (item: T, index: number) => string;
  empty: { title: string; body: string };
  pageSize?: number;
  fill?: boolean;
  scroll?: boolean;
  footerClassName?: string;
}) {
  const [page, setPage] = useState(0);
  if (items.length === 0) {
    return <EmptyState title={empty.title} body={empty.body} />;
  }
  const total = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(page, 0), total - 1);
  const start = current * pageSize;
  const slice = items.slice(start, start + pageSize);
  return (
    <div
      className={cn(
        "space-y-3",
        fill && "flex h-full min-h-0 flex-1 flex-col space-y-0",
      )}
    >
      <div
        className={cn(
          "space-y-0",
          fill && "min-h-0 flex-1",
          fill && (scroll ? "overflow-y-auto" : "overflow-hidden"),
        )}
      >
        {slice.map((item, offset) => (
          <Fragment key={keyOf(item, start + offset)}>
            {renderRow(item)}
          </Fragment>
        ))}
      </div>
      {total > 1 ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-t border-border",
            fill
              ? (footerClassName ?? "mt-auto h-9 shrink-0 bg-background px-3")
              : "pt-3",
          )}
        >
          <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
            {start + 1}–{start + slice.length} of {items.length} · page{" "}
            {current + 1} / {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={workspacePageStyles.inlineSubmit}
              onClick={() => setPage(0)}
              disabled={current === 0}
            >
              latest
            </button>
            <button
              type="button"
              className={workspacePageStyles.inlineSubmit}
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
            >
              previous
            </button>
            <button
              type="button"
              className={workspacePageStyles.inlineSubmit}
              onClick={() => setPage(Math.min(total - 1, current + 1))}
              disabled={current === total - 1}
            >
              next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
