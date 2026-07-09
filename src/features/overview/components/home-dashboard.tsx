"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import {
  AddSourceButton,
  Metric,
  RecordRow,
  Section,
  StatusBadge,
} from "@/components/life-intelligence/record-ui";
import { fetchOverview } from "@/features/overview/api/overview";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { formatCurrency } from "@/lib/life-intelligence/derive";
import { queryKeys } from "@/lib/query/keys";

function statusHasRecords(status: string) {
  return status === "connected" || status === "partial";
}

export function HomeDashboard() {
  const overviewQuery = usePersistedQuery({
    queryKey: queryKeys.overview(),
    queryFn: fetchOverview,
  });
  const overview = overviewQuery.hydratedData;
  const loading = overviewQuery.hydrationLoading;
  const hasAnyRecords = overview
    ? statusHasRecords(overview.life.status) ||
      statusHasRecords(overview.health.status) ||
      statusHasRecords(overview.finance.status)
    : false;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Section label="today" title="today">
          {loading ? (
            <Skeleton className="h-48 rounded-none" />
          ) : hasAnyRecords ? (
            <div className="space-y-5">
              <p className="text-[1.55rem] leading-tight tracking-[0.04em] text-foreground">
                {overview?.life.currentEvent?.summary ??
                  overview?.life.doNow ??
                  "records loaded"}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric
                  label="life"
                  value={`${overview?.life.todayEventCount ?? 0} today`}
                  note={overview?.life.doNext ?? "calendar and tasks"}
                />
                <Metric
                  label="health"
                  value={`${overview?.health.weekWorkoutCount ?? 0} workouts`}
                  note={overview?.health.nudge ?? "health records"}
                />
                <Metric
                  label="finance"
                  value={formatCurrency(overview?.finance.equity ?? 0)}
                  note={`${formatCurrency(overview?.finance.cash ?? 0)} cash`}
                />
              </div>
            </div>
          ) : (
            <EmptyState
              title="No life intelligence records yet."
              body="Connect Google Calendar, sync Hevy, upload meals, or import finance CSVs to populate home."
            />
          )}
        </Section>

        <Section label="sources" title="source status">
          <div className="space-y-3">
            <p className={workspacePageStyles.cardBodyText}>
              Home rolls up saved records only; generated insight placeholders
              are hidden until there is a real insight pipeline.
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                tone={
                  hasAnyRecords
                    ? "border-emerald-400/50 text-emerald-300"
                    : "border-border text-muted-foreground"
                }
              >
                {hasAnyRecords ? "records available" : "empty"}
              </StatusBadge>
              <StatusBadge>read-only</StatusBadge>
            </div>
          </div>
        </Section>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Section
          label="life"
          title="life"
          headerExtra={<AddSourceButton domain="life" />}
        >
          {overview && statusHasRecords(overview.life.status) ? (
            <RecordRow
              label="today events"
              value={`${overview.life.todayEventCount}`}
              meta={overview.life.doNext}
            />
          ) : (
            <EmptyState
              title="No life source records."
              body="Connect/sync Google Calendar and tasks to create TimeBlock records."
            />
          )}
        </Section>

        <Section
          label="health"
          title="health"
          headerExtra={<AddSourceButton domain="health" />}
        >
          {overview && statusHasRecords(overview.health.status) ? (
            <div className="space-y-0">
              <RecordRow
                label="workouts"
                value={`${overview.health.weekWorkoutCount}`}
              />
            </div>
          ) : (
            <EmptyState
              title="No health source records."
              body="Sync Hevy or save a meal from the health page."
            />
          )}
        </Section>

        <Section
          label="finance"
          title="finance"
          headerExtra={<AddSourceButton domain="finance" />}
        >
          {overview && statusHasRecords(overview.finance.status) ? (
            <RecordRow
              label="portfolio"
              value={formatCurrency(overview.finance.equity ?? 0)}
              meta={`${formatCurrency(overview.finance.cash ?? 0)} cash`}
            />
          ) : (
            <EmptyState
              title="No finance source records."
              body="Upload CSV transactions or connect a portfolio source from the finance page."
            />
          )}
        </Section>
      </section>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="text-xs text-foreground">{title}</p>
      <p className={workspacePageStyles.cardBodyText}>{body}</p>
    </div>
  );
}
