"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchAgentUsagePage } from "@/features/dev/api/dev";
import {
  DEV_PAGE_SIZE,
  PagerControls,
  pageBounds,
} from "@/features/dev/components/panels";
import { UsageAnalyticsView } from "@/features/dev/components/usage-analytics";
import type { UsageScope } from "@/features/dev/usage";
import type {
  AgentUsagePage,
  AgentUsageSession,
} from "@/features/dev/utils/maintainer";
import { queryKeys } from "@/lib/query/keys";
import { formatEventTime } from "@/lib/workspace/view-utils";

const USAGE_SCOPE_OPTIONS = [
  ["foreground", "interactive"],
  ["maintainer", "maintainer"],
] as const;

function SessionRow({
  session,
  scope,
}: {
  session: AgentUsageSession;
  scope: UsageScope;
}) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="px-2 py-3 text-[0.65rem] text-foreground">
        {session.model}
        <span className="block text-[0.55rem] text-muted-foreground">
          {session.provider}
        </span>
      </td>
      {scope === "foreground" ? (
        <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
          {session.host}
        </td>
      ) : (
        <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
          {session.stage ?? "unknown"}
        </td>
      )}
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        {session.messageCount}
      </td>
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        {session.totalTokens.toLocaleString()}
      </td>
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        ${session.usdCost.toFixed(2)}
      </td>
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        {session.lastSeenAt ? formatEventTime(session.lastSeenAt) : "unknown"}
      </td>
      <td className="px-2 py-3">
        {scope === "foreground" ? (
          <Badge
            variant={session.reviewed ? "default" : "outline"}
            className={workspacePageStyles.badgeSmall}
          >
            {session.reviewed ? "reviewed" : "unreviewed"}
          </Badge>
        ) : (
          <Badge
            variant={session.outcome === "fixed" ? "default" : "outline"}
            className={workspacePageStyles.badgeSmall}
          >
            {session.outcome ?? "unknown"}
          </Badge>
        )}
      </td>
    </tr>
  );
}

export function SessionsCardView({
  scope,
  sessions,
  total,
  page,
  loading,
  error,
  onPage,
}: {
  scope: UsageScope;
  sessions: readonly AgentUsageSession[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
  onPage: (page: number) => void;
}) {
  const { pageCount } = pageBounds(page, total, DEV_PAGE_SIZE);
  const foreground = scope === "foreground";
  const usageLabel = foreground
    ? "interactive agent usage"
    : "maintainer usage · current month";
  const sessionsLabel = foreground
    ? "interactive agent sessions"
    : "background maintainer runs";
  return (
    <Card className={workspacePageStyles.card}>
      <CardHeader className={workspacePageStyles.cardHeader}>
        <p className={workspacePageStyles.cardLabel}>
          {foreground ? "// interactive sessions" : "// maintainer runs"}
        </p>
        <h3 className={workspacePageStyles.cardTitle}>
          {usageLabel} · {total} {foreground ? "session" : "run"}
          {total === 1 ? "" : "s"}
        </h3>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {loading ? (
          <Skeleton className="h-24 rounded-none" />
        ) : error ? (
          <p className={workspacePageStyles.errorText}>{error}</p>
        ) : sessions.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-[0.65rem] text-muted-foreground">
            {foreground
              ? "Interactive agent sessions will appear here after the first run."
              : "No maintainer runs recorded this month. Approved ticket runs will appear here."}
          </p>
        ) : (
          <>
            <div className={workspacePageStyles.horizontalScroller}>
              <table
                className="w-full min-w-xl border-collapse text-left"
                aria-label={sessionsLabel}
              >
                <thead>
                  <tr className="border-b border-border">
                    <th className={workspacePageStyles.tableHead}>model</th>
                    <th className={workspacePageStyles.tableHead}>
                      {foreground ? "host" : "stage"}
                    </th>
                    <th className={workspacePageStyles.tableHead}>messages</th>
                    <th className={workspacePageStyles.tableHead}>tokens</th>
                    <th className={workspacePageStyles.tableHead}>cost</th>
                    <th className={workspacePageStyles.tableHead}>last seen</th>
                    <th className={workspacePageStyles.tableHead}>
                      {foreground ? "review" : "outcome"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow
                      key={session.sessionKey}
                      session={session}
                      scope={scope}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <PagerControls
              pager={{ page, pageCount, total, setPage: onPage }}
              label={sessionsLabel}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AgentUsageView({
  scope,
  data,
  page,
  loading,
  error,
  onPage,
  maintainerVisible = false,
}: {
  scope: UsageScope;
  data: AgentUsagePage | null;
  page: number;
  loading: boolean;
  error: string | null;
  onPage: (page: number) => void;
  maintainerVisible?: boolean;
}) {
  return (
    <div className="space-y-4">
      <UsageAnalyticsView
        scope={scope}
        analytics={data?.analytics ?? null}
        loading={loading}
        error={error}
        maintainerVisible={maintainerVisible}
      />
      <SessionsCardView
        scope={scope}
        sessions={data?.sessions ?? []}
        total={data?.total ?? 0}
        page={page}
        loading={loading}
        error={error}
        onPage={onPage}
      />
    </div>
  );
}

export function AgentUsagePanel({
  initialScope = "foreground",
  maintainerScopeVisible = false,
}: {
  initialScope?: UsageScope;
  maintainerScopeVisible?: boolean;
}) {
  const [scope, setScope] = useState<UsageScope>(initialScope);
  const [page, setPage] = useState(0);
  // Fail closed: installs without the maintainer never see its usage scope,
  // even if a stale selection points at it.
  const activeScope = maintainerScopeVisible ? scope : "foreground";
  const query = useQuery({
    queryKey: queryKeys.dev.agentUsage(activeScope, page),
    queryFn: () => fetchAgentUsagePage(activeScope, page, DEV_PAGE_SIZE),
    refetchInterval: 30_000,
    placeholderData: (previous) =>
      previous?.scope === activeScope ? previous : undefined,
  });
  const selectScope = (nextScope: UsageScope) => {
    setScope(nextScope);
    setPage(0);
  };
  const error = query.error instanceof Error ? query.error.message : null;
  return (
    <section className="space-y-4" aria-label="agent usage by scope">
      {maintainerScopeVisible ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <p className={workspacePageStyles.cardLabel}>usage scope</p>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">usage scope selector</legend>
            {USAGE_SCOPE_OPTIONS.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  workspacePageStyles.actionButton,
                  activeScope === value && "border-foreground text-foreground",
                )}
                aria-pressed={activeScope === value}
                onClick={() => selectScope(value)}
              >
                {label}
              </Button>
            ))}
          </fieldset>
        </div>
      ) : null}
      <AgentUsageView
        scope={activeScope}
        maintainerVisible={maintainerScopeVisible}
        data={query.data ?? null}
        page={page}
        loading={query.isLoading}
        error={error}
        onPage={setPage}
      />
    </section>
  );
}
