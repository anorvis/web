"use client";

import { Alert, AlertDescription, AlertTitle } from "@anorvis/ui/alert";
import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { fetchDevMaintenance } from "@/features/dev/api/dev";
import { Metric } from "@/features/dev/components/panels";
import type {
  MaintenanceOverview,
  MaintenanceTicket,
} from "@/features/dev/utils/maintenance";
import { queryKeys } from "@/lib/query/keys";

function formatTokens(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);
}

function formatCost(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 0.01 ? 4 : 2,
    maximumFractionDigits: value < 0.01 ? 4 : 2,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function labelStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (
    status === "failed" ||
    status === "verification_failed" ||
    status === "rejected"
  ) {
    return "destructive";
  }
  if (status === "running" || status === "approved" || status === "fixed") {
    return "default";
  }
  if (status === "pending_approval" || status === "blocked") return "outline";
  return "secondary";
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

function TicketRow({ ticket }: { ticket: MaintenanceTicket }) {
  return (
    <li className="space-y-3 border-b border-border/50 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[0.7rem] leading-relaxed text-foreground">
            {ticket.task}
          </p>
          <p className={workspacePageStyles.listValue}>
            updated {formatDate(ticket.updatedAt ?? ticket.createdAt)}
          </p>
        </div>
        <Badge
          variant={statusVariant(ticket.status)}
          className={workspacePageStyles.badgeSmall}
        >
          {labelStatus(ticket.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.6rem] text-muted-foreground">
        <span>
          {ticket.verificationCount > 0
            ? `${ticket.verificationCount} verification ${ticket.verificationCount === 1 ? "check" : "checks"} recorded`
            : "no verification recorded"}
        </span>
        {ticket.pullRequest ? (
          <a
            href={ticket.pullRequest}
            target="_blank"
            rel="noreferrer"
            className="border-b border-foreground/40 text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open maintainer pull request in a new tab"
          >
            open pull request
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function MaintenancePanelView({
  overview,
  loading = false,
  error = null,
  onRefresh,
}: {
  overview: MaintenanceOverview | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading operations">
        <div className={workspacePageStyles.metricsStrip}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-none" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-none" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <Alert variant="destructive" className="rounded-none">
        <AlertTitle>Maintenance data unavailable</AlertTitle>
        <AlertDescription>
          <p>
            The local maintenance service could not be reached. Private
            operational data remains on this machine.
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

  const { totals, recent, byModel } = overview.usage;
  const cachePercent =
    totals.totalTokens > 0
      ? Math.round((totals.cacheTokens / totals.totalTokens) * 100)
      : 0;

  return (
    <section className="space-y-4" aria-label="Operations maintenance overview">
      <div className={workspacePageStyles.metricsStrip}>
        <Metric label="total tokens" value={formatTokens(totals.totalTokens)} />
        <Metric label="estimated cost" value={formatCost(totals.usdCost)} />
        <Metric
          label="cache usage"
          value={`${formatTokens(totals.cacheTokens)} · ${cachePercent}%`}
        />
        <Metric
          label="output limits"
          value={String(totals.outputLimitWarningCount)}
        />
        <Metric label="sessions" value={String(totals.sessions)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          className={`${workspacePageStyles.card} lg:col-span-2 min-w-0`}
        >
          <PanelHeading label="// recent" title="sanitized sessions" />
          <CardContent className="px-5 py-4">
            {recent.length === 0 ? (
              <EmptyPanel>
                Session usage will appear after a supported local agent run is
                recorded.
              </EmptyPanel>
            ) : (
              <div className={workspacePageStyles.horizontalScroller}>
                <table
                  className="w-full min-w-2xl border-collapse text-left"
                  aria-label="Recent sanitized agent sessions"
                >
                  <thead>
                    <tr className="border-b border-border">
                      <th className={workspacePageStyles.tableHead}>activity</th>
                      <th className={workspacePageStyles.tableHead}>model</th>
                      <th className={workspacePageStyles.tableHead}>tokens</th>
                      <th className={workspacePageStyles.tableHead}>cache</th>
                      <th className={workspacePageStyles.tableHead}>cost</th>
                      <th className={workspacePageStyles.tableHead}>review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((session, index) => (
                      <tr
                        key={`${session.provider}:${session.model}:${session.lastSeenAt ?? index}`}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                          {formatDate(session.lastSeenAt)}
                        </td>
                        <td className="px-2 py-3">
                          <span className="block text-[0.65rem] text-foreground">
                            {session.model}
                          </span>
                          <span className="block text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
                            {session.provider}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-[0.65rem] text-foreground">
                          {formatTokens(session.totalTokens)}
                          <span className="block text-[0.55rem] text-muted-foreground">
                            {session.messageCount} messages
                          </span>
                        </td>
                        <td className="px-2 py-3 text-[0.65rem] text-muted-foreground">
                          {formatTokens(session.cacheTokens)}
                        </td>
                        <td className="px-2 py-3 text-[0.65rem] text-muted-foreground">
                          {formatCost(session.usdCost)}
                        </td>
                        <td className="px-2 py-3">
                          <Badge
                            variant={session.reviewed ? "default" : "outline"}
                            className={workspacePageStyles.badgeSmall}
                          >
                            {session.reviewed ? "reviewed" : "unreviewed"}
                          </Badge>
                          {session.outputLimitWarningCount > 0 ? (
                            <span className="mt-1 block text-[0.55rem] text-destructive">
                              {session.outputLimitWarningCount} output limit
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePageStyles.card}>
          <PanelHeading label="// usage" title="models" />
          <CardContent className="px-5 py-4">
            {byModel.length === 0 ? (
              <EmptyPanel>No model usage has been recorded.</EmptyPanel>
            ) : (
              <ul className={workspacePageStyles.list}>
                {byModel.map((model) => (
                  <li
                    key={`${model.provider}:${model.model}`}
                    className="border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[0.65rem] text-foreground">
                          {model.model}
                        </p>
                        <p className={workspacePageStyles.listValue}>
                          {model.provider} · {model.messageCount} messages
                        </p>
                      </div>
                      <span className={workspacePageStyles.statValue}>
                        {formatTokens(model.totalTokens)}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.55rem] text-muted-foreground">
                      {formatTokens(model.cacheTokens)} cached · {formatCost(model.usdCost)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={workspacePageStyles.card}>
        <PanelHeading label="// maintenance" title="maintainer tickets" />
        <CardContent className="px-5 py-4">
          {overview.tickets.length === 0 ? (
            <EmptyPanel>
              Monitor findings that need review will appear here before repair
              begins.
            </EmptyPanel>
          ) : (
            <ul>
              {overview.tickets.map((ticket, index) => (
                <TicketRow
                  key={`${ticket.createdAt ?? "ticket"}:${ticket.status}:${index}`}
                  ticket={ticket}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function MaintenancePanel() {
  const query = useQuery({
    queryKey: queryKeys.dev.maintenance(),
    queryFn: fetchDevMaintenance,
    refetchInterval: 30_000,
  });

  return (
    <MaintenancePanelView
      overview={query.data ?? null}
      loading={query.isLoading}
      error={query.error instanceof Error ? query.error.message : null}
      onRefresh={() => void query.refetch()}
    />
  );
}
