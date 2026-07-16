"use client";

import { Badge } from "@anorvis/ui/badge";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMaintainerTickets } from "@/features/dev/api/dev";
import {
  DEV_PAGE_SIZE,
  PagerControls,
  pageBounds,
} from "@/features/dev/components/panels";
import {
  type MaintainerTicket,
  TICKET_GROUPS,
} from "@/features/dev/utils/maintainer";
import { queryKeys } from "@/lib/query/keys";
import { formatEventTime } from "@/lib/workspace/view-utils";

const RUNNING_STATUSES: Record<string, true> = {
  pending_approval: true,
  approved: true,
  running: true,
};

function TicketRow({ ticket }: { ticket: MaintainerTicket }) {
  return (
    <li className="space-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
      <p className="line-clamp-2 text-[0.65rem] leading-relaxed text-foreground">
        {ticket.task || "(no task description)"}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={RUNNING_STATUSES[ticket.status] ? "default" : "outline"}
          className={workspacePageStyles.badgeSmall}
        >
          {ticket.status.replaceAll("_", " ")}
        </Badge>
        <span className="text-[0.55rem] text-muted-foreground">
          {ticket.project}
        </span>
        {ticket.updatedAt ? (
          <span className="text-[0.55rem] text-muted-foreground">
            {formatEventTime(ticket.updatedAt)}
          </span>
        ) : null}
        {ticket.pullRequest ? (
          <a
            href={ticket.pullRequest}
            target="_blank"
            rel="noreferrer"
            className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            pull request ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function TicketGroupCardView({
  label,
  tickets,
  total,
  page,
  loading,
  error,
  onPage,
}: {
  label: string;
  tickets: readonly MaintainerTicket[];
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
        <p className={workspacePageStyles.cardLabel}>{`// ${label}`}</p>
        <h3 className={workspacePageStyles.cardTitle}>
          {total} ticket{total === 1 ? "" : "s"}
        </h3>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {loading ? (
          <Skeleton className="h-24 rounded-none" />
        ) : error ? (
          <p className={workspacePageStyles.errorText}>{error}</p>
        ) : tickets.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-[0.65rem] text-muted-foreground">
            No {label} tickets.
          </p>
        ) : (
          <>
            <ul className={workspacePageStyles.list}>
              {tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </ul>
            <PagerControls
              pager={{ page, pageCount, total, setPage: onPage }}
              label={label}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TicketGroupCard({ group }: { group: (typeof TICKET_GROUPS)[number] }) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: queryKeys.dev.maintainerTickets(group.key, page),
    queryFn: () => fetchMaintainerTickets(group.statuses, page, DEV_PAGE_SIZE),
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
  return (
    <TicketGroupCardView
      label={group.label}
      tickets={query.data?.tickets ?? []}
      total={query.data?.total ?? 0}
      page={page}
      loading={query.isLoading}
      error={query.error instanceof Error ? query.error.message : null}
      onPage={setPage}
    />
  );
}

export function MaintainerTicketsSection() {
  return (
    <section
      className="grid gap-4 lg:grid-cols-3"
      aria-label="maintenance tickets and pull requests"
    >
      {TICKET_GROUPS.map((group) => (
        <TicketGroupCard key={group.key} group={group} />
      ))}
    </section>
  );
}
