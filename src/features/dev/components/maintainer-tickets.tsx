"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { Spinner } from "@anorvis/ui/spinner";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
} from "@/components/layout/workspace-dialog";
import {
  fetchMaintainerTickets,
  syncLinear,
  triageMaintainerTicket,
} from "@/features/dev/api/dev";
import { maintainerStatusBadgeClass } from "@/features/dev/components/maintainer-actions";
import {
  devModalClass,
  Metric,
  PagerControls,
  pageBounds,
} from "@/features/dev/components/panels";
import {
  type MaintainerTicket,
  TICKET_FILTERS,
  type TicketFilterKey,
} from "@/features/dev/utils/maintainer";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { errorMessage } from "@/lib/effect/errors";
import { queryKeys } from "@/lib/query/keys";
import { formatRelativeTime } from "@/lib/workspace/view-utils";

const TICKET_PAGE_SIZE = 10;

const ACTIVE_STATUSES: Record<string, true> = {
  pending_approval: true,
  approved: true,
  running: true,
};

const LINK_CLASS =
  "shrink-0 text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground underline underline-offset-2 hover:text-foreground";

const QUEUED_TICKET_COPY = "queued · runs with your next agent session";

type Triage = { id: string; action: "approve" | "dismiss" };

function TicketRow({
  ticket,
  inbox,
  triageBusy,
  onOpen,
  onTriage,
}: {
  ticket: MaintainerTicket;
  inbox: boolean;
  triageBusy: Triage | null;
  onOpen: () => void;
  onTriage: (action: Triage["action"]) => void;
}) {
  const busy = triageBusy?.id === ticket.id;
  return (
    <li className="border-b border-border/50 py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-3 text-left sm:w-auto sm:flex-1"
          aria-haspopup="dialog"
          aria-label={`open ticket ${ticket.id} detail`}
          onClick={onOpen}
        >
          <span className="min-w-0 flex-1 truncate text-[0.65rem] text-foreground">
            {ticket.task || "(no task description)"}
          </span>
          <Badge
            variant={ACTIVE_STATUSES[ticket.status] ? "default" : "outline"}
            className={cn(maintainerStatusBadgeClass, "shrink-0")}
          >
            {ticket.status.replaceAll("_", " ")}
          </Badge>
          <span className="shrink-0 text-[0.55rem] text-muted-foreground">
            {formatRelativeTime(ticket.updatedAt ?? ticket.createdAt)}
          </span>
        </button>
        {ticket.linearIdentifier && ticket.linearUrl ? (
          <a
            href={ticket.linearUrl}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            {ticket.linearIdentifier} ↗
          </a>
        ) : null}
        {ticket.pullRequest ? (
          <a
            href={ticket.pullRequest}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            pr ↗
          </a>
        ) : null}
        {inbox ? (
          <span className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={workspacePageStyles.actionButton}
              disabled={busy}
              onClick={() => onTriage("approve")}
            >
              approve
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={workspacePageStyles.actionButton}
              disabled={busy}
              onClick={() => onTriage("dismiss")}
            >
              dismiss
            </Button>
            {busy ? <Spinner className="size-3" /> : null}
          </span>
        ) : ticket.status === "approved" ? (
          <span className="shrink-0 text-[0.55rem] text-muted-foreground">
            {QUEUED_TICKET_COPY}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function DetailText({ label, body }: { label: string; body: string }) {
  return (
    <section className="space-y-1">
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <p className="whitespace-pre-wrap text-[0.65rem] leading-relaxed text-foreground">
        {body}
      </p>
    </section>
  );
}

function DetailList({
  label,
  items,
}: {
  label: string;
  items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-1">
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <ul className={workspacePageStyles.list}>
        {items.map((item) => (
          <li
            key={item}
            className="border-b border-border/50 pb-2 text-[0.65rem] leading-relaxed text-muted-foreground last:border-b-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function TicketDetail({ ticket }: { ticket: MaintainerTicket }) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="status" value={ticket.status.replaceAll("_", " ")} />
        <Metric label="project" value={ticket.project.slice(0, 8) || "—"} />
        <Metric label="created" value={formatRelativeTime(ticket.createdAt)} />
        <Metric label="updated" value={formatRelativeTime(ticket.updatedAt)} />
      </div>
      {ticket.status === "approved" ? (
        <p className="text-[0.6rem] text-muted-foreground">
          {QUEUED_TICKET_COPY}
        </p>
      ) : null}
      <DetailText label="task" body={ticket.task || "(no task description)"} />
      {ticket.answer ? (
        <DetailText label="answer" body={ticket.answer} />
      ) : null}
      <DetailList label="verification" items={ticket.verification} />
      <DetailList label="warnings" items={ticket.warnings} />
      {ticket.pullRequest || ticket.linearUrl ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          {ticket.pullRequest ? (
            <a
              href={ticket.pullRequest}
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              pull request ↗
            </a>
          ) : null}
          {ticket.linearUrl ? (
            <a
              href={ticket.linearUrl}
              target="_blank"
              rel="noreferrer"
              className={LINK_CLASS}
            >
              {ticket.linearIdentifier ?? "linear issue"} ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MaintainerTicketsSection() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TicketFilterKey>("inbox");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MaintainerTicket | null>(null);

  const definition =
    TICKET_FILTERS.find((entry) => entry.key === filter) ?? TICKET_FILTERS[0];
  const query = useQuery({
    queryKey: queryKeys.dev.maintainerTickets(definition.key, page),
    queryFn: () =>
      fetchMaintainerTickets(definition.statuses, page, TICKET_PAGE_SIZE),
    refetchInterval: 30_000,
    placeholderData: (previous) => previous,
  });
  const triage = useMutation({
    mutationFn: ({ id, action }: Triage) => triageMaintainerTicket(id, action),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.dev.maintainerTicketsRoot(),
      }),
  });
  // Opening the inbox is the event that reconciles the Linear board: tickets
  // triaged on Linear while everything here was idle land without pressing
  // sync. Best-effort; an unconfigured or unreachable gateway changes nothing.
  useMountEffect(() => {
    void syncLinear()
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.dev.maintainerTicketsRoot(),
        }),
      )
      .catch(() => undefined);
  });

  const tickets = query.data?.tickets ?? [];
  const total = query.data?.total ?? 0;
  const { pageCount } = pageBounds(page, total, TICKET_PAGE_SIZE);
  const error = query.error instanceof Error ? query.error.message : null;

  return (
    <section aria-label="maintenance ticket inbox">
      <Card className={workspacePageStyles.card}>
        <CardHeader className={workspacePageStyles.cardHeader}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <p className={workspacePageStyles.cardLabel}>
                {"// maintenance"}
              </p>
              <h3 className={workspacePageStyles.cardTitle}>
                {total} ticket{total === 1 ? "" : "s"} · {definition.label}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TICKET_FILTERS.map((entry) => (
                <Button
                  key={entry.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    workspacePageStyles.actionButton,
                    entry.key === filter && "border-foreground text-foreground",
                  )}
                  onClick={() => {
                    setFilter(entry.key);
                    setPage(0);
                  }}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-4">
          {query.isLoading ? (
            <Skeleton className="h-24 rounded-none" />
          ) : error ? (
            <p className={workspacePageStyles.errorText}>{error}</p>
          ) : tickets.length === 0 ? (
            <p className="border border-dashed border-border px-4 py-6 text-center text-[0.65rem] text-muted-foreground">
              {filter === "inbox"
                ? "No tickets waiting for approval."
                : `No ${definition.label} tickets.`}
            </p>
          ) : (
            <>
              <ul className={workspacePageStyles.list}>
                {tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    inbox={filter === "inbox"}
                    triageBusy={triage.isPending ? triage.variables : null}
                    onOpen={() => setSelected(ticket)}
                    onTriage={(action) =>
                      triage.mutate({ id: ticket.id, action })
                    }
                  />
                ))}
              </ul>
              <PagerControls
                pager={{ page, pageCount, total, setPage }}
                label={definition.label}
              />
            </>
          )}
          {triage.error ? (
            <p className={workspacePageStyles.errorText}>
              {errorMessage(triage.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <WorkspaceDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        className={devModalClass}
      >
        {selected ? (
          <WorkspaceModalFrame
            title="maintenance ticket"
            description={`ticket ${selected.id}`}
          >
            <TicketDetail ticket={selected} />
          </WorkspaceModalFrame>
        ) : null}
      </WorkspaceDialog>
    </section>
  );
}
