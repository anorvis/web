"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { WorkspaceMetricButton } from "@/components/layout/workspace";
import { workspacePinnedModalFooterClass } from "@/components/layout/workspace-dialog";
import { RecordRow, Section } from "@/components/life-intelligence/record-ui";
import {
  fetchFinanceDashboard,
  financeDataFromDashboard,
} from "@/features/finance/api/finance";
import {
  ACTIVITY_FEED_PAGE_SIZE,
  type ActivityFeedFilter,
  type ActivityFeedItem,
  filterFinanceActivityFeed,
  financeActivityFeed,
} from "@/features/finance/components/finance-activity-feed";
import {
  balanceBreakdown,
  type CurrencyGroups,
  cashflow,
  currentMonthKey,
  formatCurrencyAmount,
  formatCurrencyGroups,
  investmentValue,
} from "@/features/finance/components/finance-derive";
import { FinanceFlowDialog } from "@/features/finance/components/finance-flow-dialog";
import { FinanceGraph } from "@/features/finance/components/finance-graph";
import { FinanceNetWorthDialog } from "@/features/finance/components/finance-networth-dialog";
import {
  EmptyState,
  FinanceDialog,
  PaginatedRecords,
} from "@/features/finance/components/finance-panels";
import { FinanceSources } from "@/features/finance/components/finance-sources";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { queryKeys } from "@/lib/query/keys";
import { useFinancePreferences } from "@/lib/stores/finance-preferences";

type FinanceModal = "networth" | "income" | "spending" | "investments" | null;

const stableCardClass = "flex h-[28rem] min-h-0 flex-col overflow-hidden";
const activityFilters: ReadonlyArray<{
  value: ActivityFeedFilter;
  label: string;
}> = [
  { value: "all", label: "all" },
  { value: "income", label: "income" },
  { value: "spending", label: "spending" },
  { value: "stocks", label: "stocks" },
];
const shareQuantityFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

function ActivityFeedRow({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0">
      <Badge
        variant="outline"
        className={`${workspacePageStyles.badgeSmall} max-w-32 truncate rounded-none ${item.badgeTone ?? ""}`}
      >
        {item.type}
      </Badge>
      <div className="min-w-0">
        <p className="truncate text-[0.68rem] leading-tight text-foreground">
          {item.description}
        </p>
        <p className="truncate text-[0.55rem] leading-tight text-muted-foreground">
          {item.context}
        </p>
      </div>
      <p
        className={`whitespace-nowrap text-right text-[0.68rem] tabular-nums ${item.tone ?? "text-foreground"}`}
      >
        {item.value}
      </p>
    </div>
  );
}

export function FinanceDashboard() {
  const [activeModal, setActiveModal] = useState<FinanceModal>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const [activityFilter, setActivityFilter] =
    useState<ActivityFeedFilter>("all");
  const { preferredCurrency, hydratePreferredCurrency } =
    useFinancePreferences();

  useMountEffect(() => {
    hydratePreferredCurrency();
  });

  const dashboardQuery = useQuery({
    queryKey: queryKeys.finance.snapshot(preferredCurrency),
    queryFn: () => fetchFinanceDashboard(preferredCurrency),
  });

  const finance = useMemo(
    () => financeDataFromDashboard(dashboardQuery.data),
    [dashboardQuery.data],
  );

  // Net-worth history is pre-aggregated and FX-converted by anorvis-os. The
  // legacy `equity` field is retained as a compatibility alias for older OS
  // responses; the browser does not recompute or convert it.
  const history = useMemo(
    () =>
      (dashboardQuery.data?.history ?? []).map((point) => ({
        date: point.date,
        netWorth: point.netWorth ?? point.equity,
        equity: point.equity,
      })),
    [dashboardQuery.data],
  );

  const loading = dashboardQuery.isLoading;
  const loadError = dashboardQuery.isError;
  const reportingCurrency =
    dashboardQuery.data?.conversion.currency ?? preferredCurrency;

  const balances = useMemo(() => balanceBreakdown(finance), [finance]);
  const activeMonth = currentMonthKey();
  const flow = useMemo(
    () => cashflow(finance, activeMonth),
    [finance, activeMonth],
  );
  const invest = useMemo(() => investmentValue(finance), [finance]);
  const visibleAccounts = finance.accounts.filter(
    (account) => account.status !== "hidden",
  );
  const investmentAccountCount = visibleAccounts.filter(
    (account) => account.type === "investment" || account.type === "crypto",
  ).length;

  const recentActivity = useMemo(
    () => financeActivityFeed(finance, dashboardQuery.data?.activities ?? []),
    [dashboardQuery.data?.activities, finance],
  );
  const filteredActivity = useMemo(
    () =>
      filterFinanceActivityFeed(recentActivity, activityQuery, activityFilter),
    [activityFilter, activityQuery, recentActivity],
  );

  const closeModal = (open: boolean) => {
    if (!open) setActiveModal(null);
  };
  const metricValue = (groups: CurrencyGroups) =>
    loading ? "…" : formatCurrencyGroups(groups, reportingCurrency);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-4">
        <WorkspaceMetricButton
          label="net worth"
          value={metricValue(balances.net)}
          note={`${visibleAccounts.length} account${visibleAccounts.length === 1 ? "" : "s"} · ${investmentAccountCount} investment account${investmentAccountCount === 1 ? "" : "s"} · ${finance.positions.length} position${finance.positions.length === 1 ? "" : "s"}`}
          onClick={() => setActiveModal("networth")}
        />
        <WorkspaceMetricButton
          label="income"
          value={metricValue(flow.income)}
          note="posted this month · excludes transfers & investing"
          onClick={() => setActiveModal("income")}
        />
        <WorkspaceMetricButton
          label="spending"
          value={metricValue(flow.spending)}
          note="posted this month · excludes transfers & investing"
          onClick={() => setActiveModal("spending")}
        />
        <WorkspaceMetricButton
          label="investments"
          value={metricValue(invest)}
          note={`${finance.positions.length} position${finance.positions.length === 1 ? "" : "s"}`}
          onClick={() => setActiveModal("investments")}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Section
          label="activity"
          title="recent activity"
          headerExtra={
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-none px-2 text-[0.6rem]"
              onClick={() => dashboardQuery.refetch()}
              disabled={dashboardQuery.isFetching}
            >
              refresh
            </Button>
          }
        >
          <div className={stableCardClass}>
            {loading ? (
              <Skeleton className="h-full rounded-none" />
            ) : loadError && recentActivity.length === 0 ? (
              <EmptyState
                title="Finance records unavailable."
                body="Refresh to retry, or import CSV files from Sources below."
                action={
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    onClick={() => void dashboardQuery.refetch()}
                  >
                    retry
                  </button>
                }
              />
            ) : recentActivity.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-border">
                  <input
                    type="search"
                    value={activityQuery}
                    onChange={(event) => setActivityQuery(event.target.value)}
                    placeholder="search activity"
                    aria-label="search recent activity"
                    className="h-8 w-full rounded-none border-0 border-b border-border bg-transparent px-3 text-[0.65rem] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
                  />
                  <fieldset className="grid grid-cols-4 gap-1 p-1.5">
                    <legend className="sr-only">activity filters</legend>
                    {activityFilters.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        aria-pressed={activityFilter === filter.value}
                        className={`${workspacePageStyles.toggleButton} min-w-0 truncate px-1 ${activityFilter === filter.value ? "border-foreground text-foreground" : ""}`}
                        onClick={() => setActivityFilter(filter.value)}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </fieldset>
                </div>
                <PaginatedRecords
                  key={`${activityFilter}:${activityQuery}`}
                  fill
                  scroll={false}
                  items={filteredActivity}
                  pageSize={ACTIVITY_FEED_PAGE_SIZE}
                  keyOf={(activity) => activity.id}
                  empty={{
                    title: "No matching activity.",
                    body: "Adjust the search or activity filter.",
                  }}
                  renderRow={(activity) => <ActivityFeedRow item={activity} />}
                />
              </div>
            ) : (
              <EmptyState
                title="No recent activity yet."
                body="Import a bank or card CSV from Sources below, or connect SnapTrade to populate transactions."
              />
            )}
          </div>
        </Section>

        <Section label="overview" title="finance graph">
          <div className={stableCardClass}>
            <FinanceGraph
              finance={finance}
              history={history}
              currency={
                dashboardQuery.data?.conversion.currency ?? preferredCurrency
              }
              loading={loading}
              isError={loadError}
              onRetry={() => void dashboardQuery.refetch()}
            />
          </div>
        </Section>
      </section>

      <FinanceSources
        imports={dashboardQuery.data?.imports ?? []}
        sources={dashboardQuery.data?.sources ?? []}
        accounts={dashboardQuery.data?.accounts ?? []}
      />

      <FinanceNetWorthDialog
        open={activeModal === "networth"}
        onOpenChange={closeModal}
        loading={loading}
        loadError={loadError}
        finance={finance}
        balances={balances}
        returnRates={dashboardQuery.data?.returnRates ?? []}
        reportingCurrency={reportingCurrency}
        onRetry={() => void dashboardQuery.refetch()}
        onChanged={() => void dashboardQuery.refetch()}
      />

      <FinanceFlowDialog
        key={activeModal === "income" ? "income-open" : "income-closed"}
        finance={finance}
        reportingCurrency={reportingCurrency}
        kind="income"
        open={activeModal === "income"}
        onOpenChange={closeModal}
      />

      <FinanceFlowDialog
        key={activeModal === "spending" ? "spending-open" : "spending-closed"}
        finance={finance}
        reportingCurrency={reportingCurrency}
        kind="spending"
        open={activeModal === "spending"}
        onOpenChange={closeModal}
      />

      <FinanceDialog
        open={activeModal === "investments"}
        bodyClassName="pb-0"
        onOpenChange={closeModal}
        title="investments"
        description={`Positions and market values converted by anorvis-os into ${reportingCurrency}.`}
      >
        {loading ? (
          <Skeleton className="h-40 rounded-none" />
        ) : loadError && finance.positions.length === 0 ? (
          <EmptyState
            title="Investments unavailable."
            body="Refresh to retry, or connect SnapTrade from Sources."
            action={
              <button
                type="button"
                className={workspacePageStyles.modalButton}
                onClick={() => void dashboardQuery.refetch()}
              >
                retry
              </button>
            }
          />
        ) : finance.positions.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-0">
              {Array.from(invest.entries())
                .filter(([, value]) => value !== 0)
                .sort(([left], [right]) => {
                  return left.localeCompare(right);
                })
                .map(([currency, value]) => (
                  <RecordRow
                    key={currency}
                    label={`market value · ${currency}`}
                    value={formatCurrencyAmount(value, currency)}
                    meta="sum of position values"
                  />
                ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <p className={`${workspacePageStyles.cardLabel} shrink-0`}>
                positions
              </p>
              <PaginatedRecords
                fill
                footerClassName={workspacePinnedModalFooterClass}
                items={finance.positions}
                pageSize={10}
                keyOf={(position) => position.id}
                empty={{
                  title: "No positions yet.",
                  body: "Connect SnapTrade from Sources to load positions.",
                }}
                renderRow={(position) => (
                  <RecordRow
                    label={position.symbol}
                    value={formatCurrencyAmount(
                      position.marketValue ?? 0,
                      position.currency,
                    )}
                    meta={`${shareQuantityFormatter.format(position.quantity)} shares · ${position.name ?? "position"}`}
                  />
                )}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No investments yet."
            body="Connect SnapTrade from Sources to load positions and market value."
          />
        )}
      </FinanceDialog>
    </div>
  );
}
