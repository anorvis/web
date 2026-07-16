"use client";

import { Badge } from "@anorvis/ui/badge";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMaintainerSessions } from "@/features/dev/api/dev";
import {
  DEV_PAGE_SIZE,
  PagerControls,
  pageBounds,
} from "@/features/dev/components/panels";
import type { MaintainerSession } from "@/features/dev/utils/maintainer";
import { queryKeys } from "@/lib/query/keys";
import { formatEventTime } from "@/lib/workspace/view-utils";

function SessionRow({ session }: { session: MaintainerSession }) {
  return (
    <tr className="border-b border-border/50 last:border-b-0">
      <td className="px-2 py-3 text-[0.65rem] text-foreground">
        {session.model}
        <span className="block text-[0.55rem] text-muted-foreground">
          {session.provider}
        </span>
      </td>
      <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
        {session.host}
      </td>
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
        <Badge
          variant={session.reviewed ? "default" : "outline"}
          className={workspacePageStyles.badgeSmall}
        >
          {session.reviewed ? "reviewed" : "unreviewed"}
        </Badge>
      </td>
    </tr>
  );
}

export function SessionsCardView({
  sessions,
  total,
  page,
  loading,
  error,
  onPage,
}: {
  sessions: readonly MaintainerSession[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;
  onPage: (page: number) => void;
}) {
  const { pageCount } = pageBounds(page, total, DEV_PAGE_SIZE);
  return (
    <Card className={workspacePageStyles.card}>
      <CardHeader className={workspacePageStyles.cardHeader}>
        <p className={workspacePageStyles.cardLabel}>{"// sessions"}</p>
        <h3 className={workspacePageStyles.cardTitle}>
          maintainer usage · {total} session{total === 1 ? "" : "s"}
        </h3>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {loading ? (
          <Skeleton className="h-24 rounded-none" />
        ) : error ? (
          <p className={workspacePageStyles.errorText}>{error}</p>
        ) : sessions.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-[0.65rem] text-muted-foreground">
            Maintainer sessions will appear here after the first run.
          </p>
        ) : (
          <>
            <div className={workspacePageStyles.horizontalScroller}>
              <table
                className="w-full min-w-xl border-collapse text-left"
                aria-label="Maintainer session usage"
              >
                <thead>
                  <tr className="border-b border-border">
                    <th className={workspacePageStyles.tableHead}>model</th>
                    <th className={workspacePageStyles.tableHead}>host</th>
                    <th className={workspacePageStyles.tableHead}>messages</th>
                    <th className={workspacePageStyles.tableHead}>tokens</th>
                    <th className={workspacePageStyles.tableHead}>cost</th>
                    <th className={workspacePageStyles.tableHead}>last seen</th>
                    <th className={workspacePageStyles.tableHead}>review</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <SessionRow key={session.sessionKey} session={session} />
                  ))}
                </tbody>
              </table>
            </div>
            <PagerControls
              pager={{ page, pageCount, total, setPage: onPage }}
              label="maintainer sessions"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function MaintainerSessionsCard() {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: queryKeys.dev.maintainerSessions(page),
    queryFn: () => fetchMaintainerSessions(page, DEV_PAGE_SIZE),
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
  return (
    <SessionsCardView
      sessions={query.data?.sessions ?? []}
      total={query.data?.total ?? 0}
      page={page}
      loading={query.isLoading}
      error={query.error instanceof Error ? query.error.message : null}
      onPage={setPage}
    />
  );
}
