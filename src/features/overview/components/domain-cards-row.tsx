"use client";

import { useState } from "react";
import { formatAmount } from "@/features/finance/lib/currency";
import { calculateStabilityScore } from "@/features/finance/lib/score";
import type { Transaction } from "@/features/finance/types/finance";
import { DomainCard } from "@/features/overview/components/domain-card";
import {
  useFinance,
  useHealth,
  useLife,
} from "@/features/overview/components/overview-provider";
import type { DomainStatus } from "@/features/overview/types/overview";
import { useMountEffect } from "@/hooks/use-mount-effect";

function formatEquity(equity: number | null): string | null {
  if (equity === null) return null;
  return formatAmount(equity, "USD");
}

function formatDayChange(pct: number | null): string {
  if (pct === null) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}% today`;
}

type CsvFinance = {
  hasData: boolean;
  stabilityScore: number | null;
  nudge: string;
};

export function useCsvFinance(): CsvFinance {
  const [state, setState] = useState<CsvFinance>({
    hasData: false,
    stabilityScore: null,
    nudge: "",
  });

  useMountEffect(() => {
    try {
      const raw = sessionStorage.getItem("anorvis_finance_tx");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        transactions?: Transaction[];
        liquidBalance?: number | null;
      };
      const txs = data?.transactions;
      if (!Array.isArray(txs) || txs.length === 0) return;

      const score = calculateStabilityScore(txs, data.liquidBalance ?? null);
      setState({
        hasData: true,
        stabilityScore: score.overall,
        nudge: score.nudge,
      });
    } catch {
      // not available
    }
  });

  return state;
}

export function DomainCardsRow() {
  const health = useHealth();
  const life = useLife();
  const finance = useFinance();
  const csv = useCsvFinance();

  // Override finance status when CSV data exists but Alpaca isn't connected
  const financeStatus: DomainStatus =
    finance.status === "disconnected" && csv.hasData
      ? "partial"
      : finance.status;

  // Prefer Alpaca equity, fall back to stability score from CSV
  const financeScore =
    finance.equity !== null ? formatEquity(finance.equity) : csv.stabilityScore;
  const financeScoreLabel =
    finance.equity !== null ? "equity" : "stability score";

  const financeNudge =
    finance.equity !== null
      ? formatDayChange(finance.dayChangePercent)
      : csv.nudge;

  const financeDetail =
    finance.cash !== null
      ? `${formatAmount(finance.cash, "USD")} cash`
      : csv.hasData
        ? "csv data loaded · connect alpaca for portfolio"
        : "connect alpaca to see holdings";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DomainCard
        label="health"
        title="training pulse"
        href="/health"
        status={health.status}
        score={health.score}
        scoreLabel="health score"
        nudge={health.nudge}
        detail={
          health.status === "connected"
            ? `${health.weekWorkoutCount} workouts this week · ${health.confidence} confidence`
            : "connect hevy to track training"
        }
      />
      <DomainCard
        label="life"
        title="scheduler"
        href="/life"
        status={life.status}
        score={life.executionScore}
        scoreLabel="execution score"
        nudge={life.doNow}
        detail={
          life.status !== "disconnected"
            ? `${life.todayEventCount} events today`
            : "connect calendar + tasks to see your queue"
        }
      />
      <DomainCard
        label="finance"
        title="portfolio"
        href="/finance"
        status={financeStatus}
        score={financeScore}
        scoreLabel={financeScoreLabel}
        nudge={financeNudge}
        detail={financeDetail}
      />
    </div>
  );
}
