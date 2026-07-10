"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { cn } from "@anorvis/ui/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type YAxisProps,
} from "recharts";

type AxisDomain = YAxisProps["domain"];

type TrendLineSecondary = {
  dataKey: string;
  axis?: "left" | "right";
  domain?: AxisDomain;
};

/**
 * Shared monochrome line chart for the health surfaces. Encapsulates the
 * ChartContainer + LineChart + axes/grid/tooltip block that the calories modal
 * and the trends card would otherwise duplicate. Colors come from the injected
 * `--color-<dataKey>` CSS vars (define them in `config`).
 */
export function TrendLineChart({
  config,
  data,
  dataKey,
  labelKey = "label",
  className,
  yDomain,
  referenceY,
  secondary,
}: {
  config: ChartConfig;
  data: Array<Record<string, number | string | null>>;
  dataKey: string;
  labelKey?: string;
  className?: string;
  yDomain?: AxisDomain;
  referenceY?: number | null;
  secondary?: TrendLineSecondary;
}) {
  const rightAxis = secondary?.axis === "right";
  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto min-h-0 w-full", className)}
    >
      <LineChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          yAxisId="left"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          width={40}
          domain={yDomain}
        />
        {rightAxis ? (
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={40}
            domain={secondary?.domain}
          />
        ) : null}
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        {typeof referenceY === "number" ? (
          <ReferenceLine
            yAxisId="left"
            y={referenceY}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
          />
        ) : null}
        <Line
          yAxisId="left"
          type="monotone"
          dataKey={dataKey}
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        {secondary ? (
          <Line
            yAxisId={rightAxis ? "right" : "left"}
            type="monotone"
            dataKey={secondary.dataKey}
            stroke={`var(--color-${secondary.dataKey})`}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        ) : null}
      </LineChart>
    </ChartContainer>
  );
}
