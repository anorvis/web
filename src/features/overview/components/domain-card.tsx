"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { DomainStatus } from "@/features/overview/types/overview";
import { getScoreColor, getStatusTone } from "@/lib/workspace/view-utils";

const STATUS_LABEL: Record<DomainStatus, string> = {
  connected: "connected",
  partial: "partial",
  disconnected: "offline",
};

const RING_SIZE = 44;
const STROKE_WIDTH = 3.5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type DomainCardProps = {
  label: string;
  title: string;
  href: string;
  status: DomainStatus;
  score: number | string | null;
  scoreLabel: string;
  nudge: string;
  detail: string;
};

export function DomainCard({
  label,
  title,
  href,
  status,
  score,
  scoreLabel,
  nudge,
  detail,
}: DomainCardProps) {
  const numericScore = typeof score === "number" ? score : null;
  const displayScore = score !== null ? String(score) : "—";

  // Ring fill: numeric scores map directly, string values (like "$12,345") show full ring
  const ringValue =
    numericScore !== null ? numericScore : score !== null ? 100 : null;
  const pct = ringValue !== null ? Math.min(100, Math.max(0, ringValue)) : 0;
  const filled = (pct / 100) * CIRCUMFERENCE;
  const color = getScoreColor(numericScore ?? ringValue);

  // Format: numeric scores get %, string scores (equity) shown as-is
  const formattedScore =
    numericScore !== null ? `${numericScore}%` : displayScore;

  return (
    <Card className={workspacePageStyles.card}>
      <CardHeader className={workspacePageStyles.cardHeader}>
        <div className="flex items-center justify-between">
          <p className={workspacePageStyles.cardLabel}>{`// ${label}`}</p>
          <Badge
            variant="outline"
            className={cn(
              workspacePageStyles.badgeSmall,
              getStatusTone(status),
            )}
          >
            {STATUS_LABEL[status]}
          </Badge>
        </div>
        <p className={workspacePageStyles.cardTitle}>{title}</p>
      </CardHeader>
      <CardContent className={workspacePageStyles.cardBody}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              className={`shrink-0 -rotate-90 ${color}`}
              role="img"
              aria-label={`${scoreLabel}: ${formattedScore}`}
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                opacity={0.15}
              />
              {ringValue !== null && (
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="space-y-0.5">
              <p className={`text-[0.85rem] tracking-[0.05em] ${color}`}>
                {formattedScore}
              </p>
              <p className="text-[0.5rem] uppercase tracking-[0.25em] text-muted-foreground">
                {scoreLabel}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className={workspacePageStyles.actionButton}
          >
            <Link href={href}>
              open
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
        {nudge && <p className="text-[0.6rem] text-foreground">{nudge}</p>}
        {detail && (
          <p className="text-[0.55rem] text-muted-foreground">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}
