"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { convertAmount } from "@/features/finance/lib/currency";
import type {
  AlpacaPortfolio,
  Currency,
  FxRates,
  PortfolioHistoryPoint,
} from "@/features/finance/types/finance";

type PortfolioOverviewProps = {
  portfolio: AlpacaPortfolio;
  history: PortfolioHistoryPoint[];
  currency: Currency;
  rates: FxRates;
};

const chartConfig = {
  equity: {
    label: "equity",
    color: "hsl(var(--foreground))",
  },
};

function fmt(amount: number, currency: Currency): string {
  if (currency === "BTC") return `\u20bf${amount.toFixed(4)}`;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function PortfolioOverview({
  portfolio,
  history,
  currency,
  rates,
}: PortfolioOverviewProps) {
  const convert = (amount: number) =>
    convertAmount(amount, "USD", currency, rates);

  const trendData = history.map((p) => ({
    label: p.date.slice(5),
    equity: convert(p.equity),
  }));

  const totalValue = convert(portfolio.equity);
  const maxPosition = Math.max(
    ...portfolio.positions.map((p) => p.marketValue),
    1,
  );

  return (
    <div className="space-y-4">
      {/* Hero metrics */}
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-bold text-foreground tabular-nums">
          {fmt(totalValue, currency)}
        </span>
        <span className="text-[0.55rem] text-muted-foreground/50">
          {fmt(convert(portfolio.cash), currency)} cash
        </span>
      </div>

      {/* Equity chart */}
      {trendData.length > 0 && (
        <ChartContainer
          config={chartConfig}
          className="h-28 w-full min-h-0 aspect-auto"
        >
          <LineChart
            data={trendData}
            margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={40}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="var(--color-equity)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      )}

      {/* Positions with allocation bars */}
      {portfolio.positions.length > 0 && (
        <div className="space-y-1.5">
          {portfolio.positions
            .sort((a, b) => b.marketValue - a.marketValue)
            .slice(0, 10)
            .map((p) => {
              const pct = (p.marketValue / maxPosition) * 100;
              return (
                <div key={p.symbol} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={workspacePageStyles.listLabel}>
                        {p.symbol}
                      </span>
                      <span className="text-[0.45rem] text-muted-foreground/40">
                        {p.qty} shares
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={workspacePageStyles.listValue}>
                        {fmt(convert(p.marketValue), currency)}
                      </span>
                      <span
                        className={`text-[0.5rem] tabular-nums w-10 text-right ${
                          p.unrealizedPl >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {p.unrealizedPl >= 0 ? "+" : ""}
                        {(p.unrealizedPlPc * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Allocation bar */}
                  <div className="h-0.5 w-full bg-muted rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${p.unrealizedPl >= 0 ? "bg-foreground/30" : "bg-red-500/30"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
