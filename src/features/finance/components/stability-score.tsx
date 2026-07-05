"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import type { StabilityScore } from "@/features/finance/types/finance";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 67) return "text-green-500";
  if (score >= 34) return "text-yellow-500";
  return "text-red-500";
}

function scoreBg(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 67) return "bg-green-500";
  if (score >= 34) return "bg-yellow-500";
  return "bg-red-500";
}

const TREND_ARROW: Record<string, string> = {
  up: "\u25b2",
  down: "\u25bc",
  stable: "\u2014",
};

export function StabilityScoreCard({ score }: { score: StabilityScore }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        {/* Score ring */}
        <div className="relative shrink-0 size-16 flex items-center justify-center">
          <svg
            viewBox="0 0 36 36"
            className="size-16 -rotate-90"
            role="img"
            aria-label="Stability score"
          >
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="2"
              className="stroke-muted"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={`${score.overall * 0.974} 100`}
              className={scoreBg(score.overall).replace("bg-", "stroke-")}
            />
          </svg>
          <span
            className={`absolute text-lg font-bold ${scoreColor(score.overall)}`}
          >
            {score.overall}
          </span>
        </div>

        {/* Pillars */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-3 xl:grid-cols-5">
          {score.pillars.map((p) => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={workspacePageStyles.metricLabel}>
                  {p.label}
                </span>
                <span
                  className={`text-[0.6rem] tabular-nums ${scoreColor(p.score)}`}
                >
                  {p.score !== null ? p.score : "\u2014"}
                  {p.trend && (
                    <span className="ml-0.5 text-[0.5rem]">
                      {TREND_ARROW[p.trend]}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1 w-full bg-muted rounded-sm overflow-hidden">
                {p.score !== null && (
                  <div
                    className={`h-full rounded-sm ${scoreBg(p.score)}`}
                    style={{ width: `${p.score}%` }}
                  />
                )}
              </div>
              <p className="text-[0.45rem] text-muted-foreground/50">
                {p.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[0.6rem] text-muted-foreground/70 border-l-2 border-foreground/20 pl-2 italic">
        {score.nudge}
      </p>
    </div>
  );
}
