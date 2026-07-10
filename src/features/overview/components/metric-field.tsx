"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { OverviewData } from "@/features/overview/types/overview";
import { useAnimatedTextFrame } from "@/hooks/use-animated-text-frame";
import { useMountEffect } from "@/hooks/use-mount-effect";

const GLYPHS = "  .,:;irsXA253hMHGS#9B&@";
const MIN_COLUMNS = 48;
const MAX_COLUMNS = 320;
const MIN_ROWS = 24;
const MAX_ROWS = 90;
// Approximate rendered advance width of one glyph at the clamped font size;
// columns = width / CELL_WIDTH must track it or the field under-fills.
const CELL_WIDTH = 5;
const CELL_HEIGHT = 8;

type GridSize = {
  columns: number;
  rows: number;
};

type Signals = {
  life: number;
  health: number;
  finance: number;
};

export function MetricField({
  overview,
}: {
  overview: OverviewData | null | undefined;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLPreElement>(null);
  const [size, setSize] = useState<GridSize>({ columns: 120, rows: 56 });
  const signals = useMemo(() => metricSignals(overview), [overview]);

  useMountEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = (width: number, height: number) => {
      const columns = clamp(
        Math.floor(width / CELL_WIDTH),
        MIN_COLUMNS,
        MAX_COLUMNS,
      );
      const rows = clamp(Math.floor(height / CELL_HEIGHT), MIN_ROWS, MAX_ROWS);
      setSize((current) =>
        current.columns === columns && current.rows === rows
          ? current
          : { columns, rows },
      );
    };
    const bounds = container.getBoundingClientRect();
    update(bounds.width, bounds.height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  });

  const renderFrame = useCallback(
    (phase: number) => renderWaveField(size, signals, phase),
    [signals, size],
  );
  const frame = useAnimatedTextFrame(renderFrame, frameRef, 16);
  const label =
    "Animated topographic wave field derived from current Life, Health, and Finance signals.";

  return (
    <figure
      ref={containerRef}
      role="img"
      aria-label={label}
      className="flex min-h-0 flex-1 items-center overflow-hidden"
    >
      <pre
        ref={frameRef}
        aria-hidden="true"
        className="m-0 w-full select-none overflow-hidden whitespace-pre text-center font-mono text-[clamp(0.38rem,0.58vw,0.56rem)] leading-[0.86] tracking-[0.01em] text-foreground"
      >
        {frame}
      </pre>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

function metricSignals(overview: OverviewData | null | undefined): Signals {
  const life = normalizePercent(
    overview?.life.executionScore ??
      Math.min((overview?.life.todayEventCount ?? 0) * 12, 100),
  );
  const health = normalizePercent(
    overview?.health.score ??
      Math.min((overview?.health.weekWorkoutCount ?? 0) * 15, 100),
  );
  const dayChange = overview?.finance.dayChangePercent;
  const equity = overview?.finance.equity ?? 0;
  const cash = overview?.finance.cash ?? 0;
  const finance =
    dayChange !== null && dayChange !== undefined
      ? clamp((dayChange + 10) / 20, 0, 1)
      : equity > 0
        ? clamp(cash / equity, 0, 1)
        : 0.5;
  return { life, health, finance };
}

function renderWaveField(
  size: GridSize,
  signals: Signals,
  phase: number,
): string {
  const { columns, rows } = size;
  const aspect = columns / Math.max(rows, 1);
  const lifePhase = phase * (0.42 + signals.life * 0.34);
  const healthPhase = phase * (0.31 + signals.health * 0.29);
  const financePhase = phase * (0.25 + signals.finance * 0.38);
  const centerOneX = Math.sin(lifePhase) * (0.42 + signals.life * 0.18);
  const centerOneY = Math.cos(healthPhase * 0.83) * 0.36;
  const centerTwoX = Math.cos(financePhase * 0.91) * 0.58;
  const centerTwoY = Math.sin(lifePhase * 0.74) * 0.42;
  const lines = new Array<string>(rows);

  for (let row = 0; row < rows; row += 1) {
    const y = (row / Math.max(rows - 1, 1) - 0.5) * 2;
    let line = "";
    for (let column = 0; column < columns; column += 1) {
      const x = (column / Math.max(columns - 1, 1) - 0.5) * 2 * aspect * 0.52;
      const distanceOne = Math.hypot(x - centerOneX, y - centerOneY);
      const distanceTwo = Math.hypot(x - centerTwoX, y - centerTwoY);
      const current =
        Math.sin(
          x * (3.2 + signals.life * 1.8) + lifePhase + Math.sin(y * 2.7),
        ) *
          0.34 +
        Math.cos(y * (4.6 + signals.health * 2.1) - healthPhase + x * 0.9) *
          0.25 +
        Math.sin(distanceOne * (9 + signals.finance * 5) - financePhase * 1.8) *
          0.24 +
        Math.cos(distanceTwo * (11 + signals.life * 4) + healthPhase * 1.5) *
          0.17;
      const contour = 0.5 + Math.sin(current * 7.5 + phase * 0.14) * 0.5;
      const depth = clamp((current + 1) * 0.5, 0, 1);
      const intensity = clamp(contour * 0.68 + depth * 0.32, 0, 1);
      const glyphIndex = Math.min(
        GLYPHS.length - 1,
        Math.floor(intensity ** 1.35 * (GLYPHS.length - 1)),
      );
      line += GLYPHS[glyphIndex];
    }
    lines[row] = line.trimEnd();
  }

  return lines.join("\n");
}

function normalizePercent(value: number): number {
  return clamp(value / 100, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
