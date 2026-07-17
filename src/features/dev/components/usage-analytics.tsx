"use client";

import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import { Metric } from "@/features/dev/components/panels";
import {
  UsageAnalyticsDialog,
  UsageDetailMetrics,
} from "@/features/dev/components/usage-detail-dialog";
import type {
  ModelPerformance,
  ModelUsage,
  UsageAnalytics,
  UsageScope,
  UsageTotals,
} from "@/features/dev/usage";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const USAGE_METRIC_LOADING_KEYS = [
  "cost",
  "tokens",
  "throughput",
  "cache",
  "runs",
] as const;
const USAGE_CARD_LOADING_KEYS = [
  "spend",
  "efficiency",
  "models",
  "performance",
] as const;

type UsageDialog = "spend" | "efficiency" | "models" | "performance" | null;

type SummaryItem = {
  label: string;
  value: string;
};

function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

function formatCompact(value: number): string {
  return compactFormatter.format(value);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatRate(value: number): string {
  return `${value.toFixed(1)} tok/s`;
}

function formatDuration(value: number): string {
  return value >= 1_000
    ? `${(value / 1_000).toFixed(2)} s`
    : `${Math.round(value)} ms`;
}

/** Cache reads are reusable prompt tokens; uncached input is the honest miss proxy. */
function cacheHitRate(totals: UsageTotals): number {
  const eligibleInput = totals.inputTokens + totals.cacheReadTokens;
  return eligibleInput > 0 ? (totals.cacheReadTokens / eligibleInput) * 100 : 0;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function costPerSession(totals: UsageTotals): number {
  return totals.sessions > 0 ? totals.usdCost / totals.sessions : 0;
}

function costPerMillionTokens(totals: UsageTotals): number {
  return totals.totalTokens > 0
    ? (totals.usdCost * 1_000_000) / totals.totalTokens
    : 0;
}

function UsageDetailCard({
  label,
  title,
  description,
  items,
  onOpen,
}: {
  label: string;
  title: string;
  description: string;
  items: readonly SummaryItem[];
  onOpen: () => void;
}) {
  return (
    <Card className="gap-0 rounded-none border-0 bg-background py-0 shadow-none">
      <button
        type="button"
        className="block h-full w-full text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-foreground"
        aria-haspopup="dialog"
        aria-label={`open ${title} detail`}
        onClick={onOpen}
      >
        <CardHeader className={workspacePageStyles.cardHeader}>
          <p className={workspacePageStyles.cardLabel}>{label}</p>
          <div className="space-y-1">
            <h2 className={workspacePageStyles.cardTitle}>{title}</h2>
            <p className={workspacePageStyles.cardBodyText}>{description}</p>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="min-w-0 border-l border-border pl-2"
            >
              <p className={workspacePageStyles.metricLabel}>{item.label}</p>
              <p className="truncate text-[0.7rem] tracking-[0.08em] text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </CardContent>
      </button>
    </Card>
  );
}

function ModelIdentity({ model }: { model: ModelUsage }) {
  return (
    <span className="text-[0.65rem] text-foreground">
      {model.model}
      <span className="block text-[0.55rem] text-muted-foreground">
        {model.provider}
      </span>
    </span>
  );
}

function UsageModelTable({
  models,
  label,
}: {
  models: readonly ModelUsage[];
  label: string;
}) {
  return (
    <div className={workspacePageStyles.horizontalScroller}>
      <table
        className="w-full min-w-xl border-collapse text-left"
        aria-label={label}
      >
        <thead>
          <tr className="border-b border-border">
            <th className={workspacePageStyles.tableHead}>model</th>
            <th className={workspacePageStyles.tableHead}>sessions</th>
            <th className={workspacePageStyles.tableHead}>messages</th>
            <th className={workspacePageStyles.tableHead}>tokens</th>
            <th className={workspacePageStyles.tableHead}>cost</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr
              key={`${model.provider}/${model.model}`}
              className="border-b border-border/50 last:border-b-0"
            >
              <td className="px-2 py-3">
                <ModelIdentity model={model} />
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.sessions)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.messageCount)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.totalTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatCurrency(model.usdCost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EfficiencyModelTable({ models }: { models: readonly ModelUsage[] }) {
  return (
    <div className={workspacePageStyles.horizontalScroller}>
      <table
        className="w-full min-w-2xl border-collapse text-left"
        aria-label="Top models by tokens"
      >
        <thead>
          <tr className="border-b border-border">
            <th className={workspacePageStyles.tableHead}>model</th>
            <th className={workspacePageStyles.tableHead}>uncached input</th>
            <th className={workspacePageStyles.tableHead}>cache read</th>
            <th className={workspacePageStyles.tableHead}>cache write</th>
            <th className={workspacePageStyles.tableHead}>output</th>
            <th className={workspacePageStyles.tableHead}>hit rate</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr
              key={`${model.provider}/${model.model}`}
              className="border-b border-border/50 last:border-b-0"
            >
              <td className="px-2 py-3">
                <ModelIdentity model={model} />
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.inputTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.cacheReadTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.cacheWriteTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.outputTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatPercent(cacheHitRate(model))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PerformanceModelTable({
  performance,
}: {
  performance: readonly ModelPerformance[];
}) {
  return (
    <div className={workspacePageStyles.horizontalScroller}>
      <table
        className="w-full min-w-2xl border-collapse text-left"
        aria-label="Rolling model performance ranked by output tokens"
      >
        <thead>
          <tr className="border-b border-border">
            <th className={workspacePageStyles.tableHead}>model</th>
            <th className={workspacePageStyles.tableHead}>output tokens</th>
            <th className={workspacePageStyles.tableHead}>output tok/s</th>
            <th className={workspacePageStyles.tableHead}>avg TTFT</th>
            <th className={workspacePageStyles.tableHead}>samples</th>
          </tr>
        </thead>
        <tbody>
          {performance.map((model) => (
            <tr
              key={model.modelKey}
              className="border-b border-border/50 last:border-b-0"
            >
              <td className="px-2 py-3 text-[0.65rem] text-foreground">
                {model.modelKey}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.outputTokens)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatRate(model.tokensPerSecond)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatDuration(model.timeToFirstTokenMs)}
              </td>
              <td className="px-2 py-3 text-[0.6rem] text-muted-foreground">
                {formatInteger(model.samples)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsageAnalyticsView({
  scope,
  analytics,
  loading,
  error,
}: {
  scope: UsageScope;
  analytics: UsageAnalytics | null;
  loading: boolean;
  error: string | null;
}) {
  const maintainerScope = scope === "maintainer";
  const usageName = maintainerScope
    ? "maintainer usage"
    : "interactive agent usage";
  const unitLabel = maintainerScope ? "run" : "session";
  const [dialog, setDialog] = useState<UsageDialog>(null);
  const modelsByTokens = useMemo(
    () =>
      [...(analytics?.byModel ?? [])].sort(
        (left, right) => right.totalTokens - left.totalTokens,
      ),
    [analytics],
  );
  const modelsByCost = useMemo(
    () =>
      [...(analytics?.byModel ?? [])].sort(
        (left, right) => right.usdCost - left.usdCost,
      ),
    [analytics],
  );
  const performanceByOutput = useMemo(
    () =>
      [...(analytics?.performance.byModel ?? [])].sort(
        (left, right) => right.outputTokens - left.outputTokens,
      ),
    [analytics],
  );

  if (loading) {
    return (
      <output
        className="block space-y-4"
        aria-busy="true"
        aria-label={`Loading ${usageName} analytics`}
      >
        <div className={workspacePageStyles.metricsStrip}>
          {USAGE_METRIC_LOADING_KEYS.map((key) => (
            <Skeleton key={key} className="h-14 rounded-none" />
          ))}
        </div>
        <div className="grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
          {USAGE_CARD_LOADING_KEYS.map((key) => (
            <Skeleton key={key} className="h-52 rounded-none" />
          ))}
        </div>
      </output>
    );
  }

  if (error || !analytics) {
    return (
      <section
        aria-label={`${usageName} analytics unavailable`}
        className="border border-destructive px-4 py-3"
      >
        <p className={workspacePageStyles.cardTitle}>{usageName} unavailable</p>
        <p className={workspacePageStyles.errorText}>
          {error ?? "No scoped usage response was returned."}
        </p>
      </section>
    );
  }

  const totals = analytics.totals;
  const performance = analytics.performance.totals;
  const hitRate = cacheHitRate(totals);
  const noUsage = totals.sessions === 0 && modelsByTokens.length === 0;

  return (
    <section className="space-y-4" aria-label={`${usageName} analytics`}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-1">
          <p className={workspacePageStyles.cardLabel}>
            {maintainerScope
              ? "// background maintainer"
              : "// interactive agent"}
          </p>
          <h2 className={workspacePageStyles.cardTitle}>
            {usageName}
            {maintainerScope ? " · current month" : ""}
          </h2>
        </div>
        <p className={workspacePageStyles.cardBodyText}>
          {maintainerScope
            ? "Background maintainer workers and private generalizers only; interactive sessions are excluded."
            : "Interactive foreground sessions only; background maintainer workers and generalizers are excluded."}
        </p>
      </header>
      <div className={workspacePageStyles.metricsStrip}>
        <Metric label="total cost" value={formatCurrency(totals.usdCost)} />
        <Metric
          label="total tokens"
          value={formatInteger(totals.totalTokens)}
        />
        <Metric
          label="output tok/s"
          value={formatRate(performance.tokensPerSecond)}
        />
        <Metric label="cache hit rate" value={formatPercent(hitRate)} />
        <Metric
          label={maintainerScope ? "runs" : "sessions"}
          value={formatInteger(totals.sessions)}
        />
      </div>

      {noUsage ? (
        <div className="border border-dashed border-border px-4 py-8 text-center">
          <p className={workspacePageStyles.cardTitle}>
            {maintainerScope
              ? "No maintainer usage recorded this month."
              : "No interactive agent usage recorded yet."}
          </p>
          <p className={workspacePageStyles.cardBodyText}>
            {maintainerScope
              ? "Approved ticket runs will populate current-month spend, cache, and model detail."
              : "Run an interactive agent session to populate spend, cache, and model detail."}
          </p>
        </div>
      ) : null}
      <div className="grid gap-px border border-border bg-border md:grid-cols-2 xl:grid-cols-4">
        <UsageDetailCard
          label="// spend + volume"
          title="spend and volume"
          description={`${maintainerScope ? "Run" : "Session"} economics and aggregate traffic.`}
          onOpen={() => setDialog("spend")}
          items={[
            {
              label: `cost / ${unitLabel}`,
              value: formatCurrency(costPerSession(totals)),
            },
            {
              label: "cost / M-token",
              value: formatCurrency(costPerMillionTokens(totals)),
            },
            { label: "messages", value: formatCompact(totals.messageCount) },
            {
              label: "warnings",
              value: formatInteger(totals.outputLimitWarningCount),
            },
          ]}
        />
        <UsageDetailCard
          label="// token + cache"
          title="token and cache efficiency"
          description="Uncached input stays separate from cache traffic."
          onOpen={() => setDialog("efficiency")}
          items={[
            {
              label: "uncached input",
              value: formatCompact(totals.inputTokens),
            },
            {
              label: "cache read",
              value: formatCompact(totals.cacheReadTokens),
            },
            {
              label: "cache write",
              value: formatCompact(totals.cacheWriteTokens),
            },
            {
              label: "output tokens",
              value: formatCompact(totals.outputTokens),
            },
          ]}
        />
        <UsageDetailCard
          label="// model mix"
          title="model mix"
          description="Token and cost distribution across active models."
          onOpen={() => setDialog("models")}
          items={[
            {
              label: "models",
              value: formatInteger(analytics.byModel.length),
            },
            {
              label: "top token model",
              value: modelsByTokens[0]?.model ?? "—",
            },
            { label: "top cost model", value: modelsByCost[0]?.model ?? "—" },
            { label: "total cost", value: formatCurrency(totals.usdCost) },
          ]}
        />
        <UsageDetailCard
          label="// model performance · rolling"
          title="model performance"
          description="Scope-isolated rolling throughput and latency."
          onOpen={() => setDialog("performance")}
          items={[
            {
              label: "output tok/s",
              value: formatRate(performance.tokensPerSecond),
            },
            {
              label: "avg TTFT",
              value: formatDuration(performance.timeToFirstTokenMs),
            },
            {
              label: "perf output",
              value: formatCompact(performance.outputTokens),
            },
            { label: "samples", value: formatInteger(performance.samples) },
          ]}
        />
      </div>

      <UsageAnalyticsDialog
        open={dialog === "spend"}
        onOpenChange={(open) => setDialog(open ? "spend" : null)}
        title="spend and volume"
        description={`Aggregate ${usageName} spend, volume, and the models driving cost.`}
      >
        <UsageDetailMetrics
          items={[
            { label: "total cost", value: formatCurrency(totals.usdCost) },
            { label: `${unitLabel}s`, value: formatInteger(totals.sessions) },
            { label: "messages", value: formatInteger(totals.messageCount) },
            { label: "total tokens", value: formatInteger(totals.totalTokens) },
            {
              label: `cost / ${unitLabel}`,
              value: formatCurrency(costPerSession(totals)),
            },
            {
              label: "cost / M-token",
              value: formatCurrency(costPerMillionTokens(totals)),
            },
            {
              label: "warnings",
              value: formatInteger(totals.outputLimitWarningCount),
            },
          ]}
        />
        <section className="space-y-2" aria-label="models ranked by cost">
          <h3 className={workspacePageStyles.cardLabel}>top models by cost</h3>
          <UsageModelTable models={modelsByCost} label="Top models by cost" />
        </section>
      </UsageAnalyticsDialog>

      <UsageAnalyticsDialog
        open={dialog === "efficiency"}
        onOpenChange={(open) => setDialog(open ? "efficiency" : null)}
        title="token and cache efficiency"
        description="Uncached input is the cache-miss proxy; cache reads and writes remain distinct."
      >
        <UsageDetailMetrics
          items={[
            {
              label: "uncached input",
              value: formatInteger(totals.inputTokens),
            },
            {
              label: "cache read",
              value: formatInteger(totals.cacheReadTokens),
            },
            {
              label: "cache write",
              value: formatInteger(totals.cacheWriteTokens),
            },
            { label: "cache hit rate", value: formatPercent(hitRate) },
            {
              label: "output tokens",
              value: formatInteger(totals.outputTokens),
            },
            {
              label: "warnings",
              value: formatInteger(totals.outputLimitWarningCount),
            },
          ]}
        />
        <section className="space-y-2" aria-label="models ranked by tokens">
          <h3 className={workspacePageStyles.cardLabel}>
            top models by tokens
          </h3>
          <EfficiencyModelTable models={modelsByTokens} />
        </section>
      </UsageAnalyticsDialog>

      <UsageAnalyticsDialog
        open={dialog === "models"}
        onOpenChange={(open) => setDialog(open ? "models" : null)}
        title="model mix"
        description={`Token and spend distribution across models used by ${usageName}.`}
      >
        <UsageDetailMetrics
          items={[
            { label: "models", value: formatInteger(analytics.byModel.length) },
            { label: "total tokens", value: formatInteger(totals.totalTokens) },
            { label: "total cost", value: formatCurrency(totals.usdCost) },
            { label: `${unitLabel}s`, value: formatInteger(totals.sessions) },
            {
              label: "warnings",
              value: formatInteger(totals.outputLimitWarningCount),
            },
          ]}
        />
        <section className="space-y-2" aria-label="model mix ranked by tokens">
          <h3 className={workspacePageStyles.cardLabel}>
            model mix · ranked by tokens
          </h3>
          <UsageModelTable
            models={modelsByTokens}
            label="Model mix ranked by tokens"
          />
        </section>
      </UsageAnalyticsDialog>

      <UsageAnalyticsDialog
        open={dialog === "performance"}
        onOpenChange={(open) => setDialog(open ? "performance" : null)}
        title="model performance · rolling aggregates"
        description="Scope-isolated generation telemetry, never session wall time."
      >
        <UsageDetailMetrics
          items={[
            {
              label: "output tokens",
              value: formatInteger(performance.outputTokens),
            },
            {
              label: "output tok/s",
              value: formatRate(performance.tokensPerSecond),
            },
            {
              label: "avg TTFT",
              value: formatDuration(performance.timeToFirstTokenMs),
            },
            { label: "samples", value: formatInteger(performance.samples) },
            {
              label: "warnings",
              value: formatInteger(totals.outputLimitWarningCount),
            },
          ]}
        />
        <section className="space-y-2" aria-label="rolling model performance">
          <h3 className={workspacePageStyles.cardLabel}>
            model performance · rolling output
          </h3>
          <PerformanceModelTable performance={performanceByOutput} />
        </section>
      </UsageAnalyticsDialog>
    </section>
  );
}
