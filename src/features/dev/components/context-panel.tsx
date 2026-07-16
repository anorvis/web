"use client";

import { Alert, AlertDescription, AlertTitle } from "@anorvis/ui/alert";
import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { fetchDevContext } from "@/features/dev/api/dev";
import {
  Metric,
  PagerControls,
  usePagedItems,
} from "@/features/dev/components/panels";
import type {
  ContextEventMeta,
  ContextOverview,
  ContextSummary,
  ContextWikiPage,
} from "@/features/dev/utils/context";
import { queryKeys } from "@/lib/query/keys";

const LOADING_METRIC_KEYS = [
  "gateway",
  "events",
  "summaries",
  "wiki",
  "monitor",
] as const;

function formatDate(value: string | null): string {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function EmptyPanel({ children }: { children: string }) {
  return (
    <p className="border border-dashed border-border px-4 py-8 text-center text-[0.65rem] text-muted-foreground">
      {children}
    </p>
  );
}

function PanelHeading({ label, title }: { label: string; title: string }) {
  return (
    <CardHeader className={workspacePageStyles.cardHeader}>
      <p className={workspacePageStyles.cardLabel}>{label}</p>
      <h2 className={workspacePageStyles.cardTitle}>{title}</h2>
    </CardHeader>
  );
}

function EventRow({ event }: { event: ContextEventMeta }) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        {formatDate(event.occurredAt)}
      </td>
      <td className="px-2 py-3 text-[0.65rem] text-foreground">
        {event.kind.replaceAll("_", " ")}
      </td>
      <td className="px-2 py-3">
        <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          {event.surface}
        </span>
      </td>
      <td className="px-2 py-3">
        <Badge
          variant={event.visibility === "shared" ? "default" : "outline"}
          className={workspacePageStyles.badgeSmall}
        >
          {event.visibility}
        </Badge>
      </td>
    </tr>
  );
}

function SummaryRow({ entry }: { entry: ContextSummary }) {
  return (
    <li className="border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
      <p className="line-clamp-3 text-[0.65rem] leading-relaxed text-foreground">
        {entry.summary}
      </p>
      <p className={`mt-1 ${workspacePageStyles.listValue}`}>
        {entry.scopeKind}
        {entry.visibility ? ` · ${entry.visibility}` : ""} · updated{" "}
        {formatDate(entry.updatedAt)}
      </p>
    </li>
  );
}

function EventsTable({ events }: { events: ContextEventMeta[] }) {
  const { pageItems, pager } = usePagedItems(events);
  return (
    <>
      <div className={workspacePageStyles.horizontalScroller}>
        <table
          className="w-full min-w-xl border-collapse text-left"
          aria-label="Recent sanitized context events"
        >
          <thead>
            <tr className="border-b border-border">
              <th className={workspacePageStyles.tableHead}>occurred</th>
              <th className={workspacePageStyles.tableHead}>kind</th>
              <th className={workspacePageStyles.tableHead}>surface</th>
              <th className={workspacePageStyles.tableHead}>visibility</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((event, index) => (
              <EventRow
                key={event.id || `${pager.page}-${index}`}
                event={event}
              />
            ))}
          </tbody>
        </table>
      </div>
      <PagerControls pager={pager} label="context events" />
    </>
  );
}

function SummaryList({ summaries }: { summaries: ContextSummary[] }) {
  const { pageItems, pager } = usePagedItems(summaries);
  return (
    <>
      <ul className={workspacePageStyles.list}>
        {pageItems.map((entry, index) => (
          <SummaryRow
            key={`${entry.updatedAt ?? "summary"}:${pager.page}-${index}`}
            entry={entry}
          />
        ))}
      </ul>
      <PagerControls pager={pager} label="monitor summaries" />
    </>
  );
}

function WikiPagesList({ pages }: { pages: ContextWikiPage[] }) {
  const { pageItems, pager } = usePagedItems(pages);
  return (
    <div className="space-y-2">
      <ul className={workspacePageStyles.list}>
        {pageItems.map((page) => (
          <li
            key={page.path}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="truncate text-[0.65rem] text-foreground">
              {page.title}
            </span>
            <span className="shrink-0 text-[0.55rem] text-muted-foreground">
              {page.path}
            </span>
          </li>
        ))}
      </ul>
      <PagerControls pager={pager} label="wiki pages" />
    </div>
  );
}

export function ContextPanelView({
  overview,
  loading = false,
  error = null,
  onRefresh,
}: {
  overview: ContextOverview | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  if (loading) {
    return (
      <output
        className="block space-y-4"
        aria-busy="true"
        aria-label="Loading operations"
      >
        <div className={workspacePageStyles.metricsStrip}>
          {LOADING_METRIC_KEYS.map((key) => (
            <Skeleton key={key} className="h-14 rounded-none" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-none" />
      </output>
    );
  }

  if (error || !overview) {
    return (
      <Alert variant="destructive" className="rounded-none">
        <AlertTitle>Context data unavailable</AlertTitle>
        <AlertDescription>
          <p>
            The local Anorvis OS gateway could not be reached. Private context
            never leaves this machine.
          </p>
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={workspacePageStyles.actionButton}
              onClick={onRefresh}
            >
              retry
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  const { os, context } = overview;
  const monitorRegistered = os?.services.includes("context") ?? false;

  return (
    <section
      className="space-y-4"
      aria-label="Shared context operations overview"
    >
      <div className={workspacePageStyles.metricsStrip}>
        <Metric label="os gateway" value={os?.ok ? "online" : "offline"} />
        <Metric label="services" value={String(os?.services.length ?? 0)} />
        <Metric
          label="summaries"
          value={context ? String(context.summaries.length) : "—"}
        />
        <Metric
          label="recent events"
          value={context ? String(context.events.length) : "—"}
        />
        <Metric
          label="wiki pages"
          value={context ? String(context.wikiPages.length) : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={`${workspacePageStyles.card} lg:col-span-2 min-w-0`}>
          <PanelHeading label="// recent" title="sanitized context events" />
          <CardContent className="px-5 py-4">
            {!context ? (
              <EmptyPanel>
                Shared context is unavailable. Events will appear once the OS
                context client is configured and reachable.
              </EmptyPanel>
            ) : context.events.length === 0 ? (
              <EmptyPanel>
                Context events will appear after a connected surface records
                activity.
              </EmptyPanel>
            ) : (
              <EventsTable events={context.events} />
            )}
          </CardContent>
        </Card>

        <Card className={workspacePageStyles.card}>
          <PanelHeading label="// summaries" title="monitor summaries" />
          <CardContent className="px-5 py-4">
            {!context ? (
              <EmptyPanel>
                Summaries appear once the Monitor can reach shared context.
              </EmptyPanel>
            ) : context.summaries.length === 0 ? (
              <EmptyPanel>
                The Monitor has not distilled any summaries yet.
              </EmptyPanel>
            ) : (
              <SummaryList summaries={context.summaries} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={workspacePageStyles.card}>
        <PanelHeading label="// monitor" title="shared context monitor" />
        <CardContent className="space-y-3 px-5 py-4">
          <p className="text-[0.65rem] leading-relaxed text-muted-foreground">
            The Monitor drains owner-scoped context events on this machine,
            distills them into summaries and wiki tasks, and queues outbound
            notifications. Raw prompt, assistant, and tool payloads never leave
            Anorvis OS — only counts and sanitized metadata are shown here.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={monitorRegistered ? "default" : "destructive"}
              className={workspacePageStyles.badgeSmall}
            >
              {monitorRegistered
                ? "context service registered"
                : "context service missing"}
            </Badge>
            <Badge
              variant={context ? "default" : "outline"}
              className={workspacePageStyles.badgeSmall}
            >
              {context
                ? "compile pipeline reachable"
                : "compile pipeline offline"}
            </Badge>
            {context && context.summaries.length > 0 ? (
              <span className="text-[0.6rem] text-muted-foreground">
                last summary{" "}
                {formatDate(context.summaries[0]?.updatedAt ?? null)}
              </span>
            ) : null}
          </div>
          {context && context.wikiPages.length > 0 ? (
            <WikiPagesList pages={context.wikiPages} />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export function ContextPanel() {
  const query = useQuery({
    queryKey: queryKeys.dev.context(),
    queryFn: fetchDevContext,
    refetchInterval: 30_000,
  });

  return (
    <ContextPanelView
      overview={query.data ?? null}
      loading={query.isLoading}
      error={query.error instanceof Error ? query.error.message : null}
      onRefresh={() => void query.refetch()}
    />
  );
}
