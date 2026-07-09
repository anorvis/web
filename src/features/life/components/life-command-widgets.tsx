"use client";

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { lifeStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  Flame,
  Focus,
  ImageIcon,
  Pencil,
  Timer,
  Trash2,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";
import { EmptyTaskText } from "@/features/life/components/task-row";
import { useInspirationStore } from "@/features/life/stores/inspiration-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function workloadTone(load: number) {
  if (load >= 0.82) return "overloaded";
  if (load >= 0.58) return "balanced";
  if (load > 0) return "light";
  return "open";
}

function loadBasisLabel(minutes: number) {
  return `${minutesLabel(minutes)} / 10h day`;
}

function scheduledMinutes(events: CalendarEvent[]) {
  return events
    .filter((event) => !event.allDay)
    .reduce(
      (total, event) =>
        total + Math.max(0, event.endMinute - event.startMinute),
      0,
    );
}

function countOpenFocusBlocks(events: CalendarEvent[]) {
  const timed = events
    .filter((event) => !event.allDay)
    .map((event) => ({
      start: Math.max(0, event.startMinute),
      end: Math.min(1440, event.endMinute),
    }))
    .sort((a, b) => a.start - b.start);
  const workStart = 8 * 60;
  const workEnd = 18 * 60;
  let cursor = workStart;
  let blocks = 0;

  for (const event of timed) {
    if (event.end <= workStart || event.start >= workEnd) continue;
    if (event.start - cursor >= 45) blocks += 1;
    cursor = Math.max(cursor, event.end);
  }
  if (workEnd - cursor >= 45) blocks += 1;
  return blocks;
}

export function LifePanel({
  label,
  title,
  meta,
  action,
  children,
}: {
  label: string;
  title: string;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={lifeStyles.panel}>
      <div className={lifeStyles.panelHeader}>
        <div>
          <p className={lifeStyles.panelLabel}>{label}</p>
          <h2 className={lifeStyles.panelTitle}>{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && <p className={lifeStyles.panelMeta}>{meta}</p>}
          {action}
        </div>
      </div>
      <div className={lifeStyles.panelBody}>{children}</div>
    </section>
  );
}

function isToday(value: number) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function isWithinNextWeek(value: number) {
  const now = Date.now();
  return value >= now && value <= now + 7 * 24 * 60 * 60 * 1000;
}

function pressureTone(score: number) {
  if (score >= 10) {
    return {
      label: "high",
      ring: "var(--destructive)",
      pressureClass: "bg-destructive/10 text-destructive",
      valueClass: lifeStyles.metricValueDanger,
      metaClass: lifeStyles.signalMetaDanger,
    };
  }
  if (score >= 5) {
    return {
      label: "active",
      ring: "#d97706",
      pressureClass: "bg-amber-500/10 text-amber-700 dark:text-amber-200",
      valueClass: lifeStyles.metricValueWarn,
      metaClass: lifeStyles.signalMetaWarn,
    };
  }
  if (score > 0) {
    return {
      label: "low",
      ring: "#0891b2",
      pressureClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
      valueClass: lifeStyles.metricValue,
      metaClass: lifeStyles.signalMeta,
    };
  }
  return {
    label: "clear",
    ring: "#16a34a",
    pressureClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    valueClass: lifeStyles.metricValue,
    metaClass: lifeStyles.signalMeta,
  };
}

export function TodayWorkloadPanel({ snapshot }: { snapshot: LifeSnapshot }) {
  const eventMinutes = scheduledMinutes(snapshot.todayCalendarEvents);
  const taskMinutes = scheduledMinutes(
    snapshot.todayCalendarEvents.filter(
      (event) => event.type === "plannedTask",
    ),
  );
  const load = Math.min(1, eventMinutes / (10 * 60));
  const freeBlocks = countOpenFocusBlocks(snapshot.todayCalendarEvents);
  const overdue = snapshot.queue.filter(
    (task) => task.label === "overdue",
  ).length;
  const dueToday = snapshot.queue.filter(
    (task) => task.dueAt !== null && isToday(task.dueAt),
  ).length;
  const dueThisWeek = snapshot.queue.filter(
    (task) => task.dueAt !== null && isWithinNextWeek(task.dueAt),
  ).length;
  const urgentOpen = snapshot.queue.filter((task) => task.score >= 3).length;
  const pressureScore = overdue * 3 + dueToday * 2 + dueThisWeek + urgentOpen;
  const pressure = pressureTone(pressureScore);
  const loadPercent = Math.round(load * 100);
  const pressurePercent = Math.min(100, pressureScore * 7);
  const urgentClass =
    urgentOpen > 0
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-border/60 bg-background/60 text-muted-foreground";

  return (
    <LifePanel
      label="// workload"
      title={workloadTone(load)}
      meta={snapshot.timezoneLabel}
    >
      <div className="grid h-full min-h-[17.25rem] grid-rows-[auto_1fr_auto] gap-2">
        <div className={`${lifeStyles.workloadHero} ${pressure.pressureClass}`}>
          <div
            className={lifeStyles.workloadGauge}
            style={{
              background: `conic-gradient(${pressure.ring} ${pressurePercent}%, hsl(var(--muted)) 0)`,
            }}
          >
            <div className={lifeStyles.workloadGaugeCore}>{pressureScore}</div>
          </div>
          <div className="min-w-0">
            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
              pressure
            </p>
            <p className="truncate text-[0.9rem] uppercase tracking-[0.12em] text-foreground">
              {pressure.label}
            </p>
            <p className="truncate text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
              {dueThisWeek} due week / {overdue} overdue / {urgentOpen} urgent
            </p>
          </div>
          <div className="text-right">
            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
              load
            </p>
            <p className="text-[0.9rem] tracking-[0.08em] text-foreground">
              {loadPercent}%
            </p>
            <p className="text-[0.52rem] uppercase tracking-[0.14em] text-muted-foreground">
              {loadBasisLabel(eventMinutes)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className={lifeStyles.workloadMetric}>
            <div className={lifeStyles.workloadMetricIcon}>
              <CalendarDays className="size-3.5" />
            </div>
            <div>
              <p className={lifeStyles.metricValue}>
                {snapshot.todayCalendarEvents.length}
              </p>
              <p className={lifeStyles.metricLabel}>events</p>
            </div>
          </div>
          <div className={lifeStyles.workloadMetric}>
            <div className={lifeStyles.workloadMetricIcon}>
              <Clock3 className="size-3.5" />
            </div>
            <div>
              <p className={lifeStyles.metricValue}>
                {minutesLabel(eventMinutes)}
              </p>
              <p className={lifeStyles.metricLabel}>scheduled</p>
            </div>
          </div>
          <div className={lifeStyles.workloadMetric}>
            <div className={lifeStyles.workloadMetricIcon}>
              <Timer className="size-3.5" />
            </div>
            <div>
              <p className={lifeStyles.metricValue}>
                {minutesLabel(taskMinutes)}
              </p>
              <p className={lifeStyles.metricLabel}>task blocks</p>
            </div>
          </div>
          <div className={lifeStyles.workloadMetric}>
            <div className={lifeStyles.workloadMetricIcon}>
              <Focus className="size-3.5" />
            </div>
            <div>
              <p className={lifeStyles.metricValue}>{freeBlocks}</p>
              <p className={lifeStyles.metricLabel}>focus</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={lifeStyles.workloadMiniMetric}>
            <p className={lifeStyles.metricValue}>{dueToday}</p>
            <p className={lifeStyles.metricLabel}>due today</p>
          </div>
          <div className={lifeStyles.workloadMiniMetric}>
            <p className={pressure.valueClass}>{dueThisWeek}</p>
            <p className={lifeStyles.metricLabel}>due week</p>
          </div>
          <div className={`${lifeStyles.workloadMiniMetric} ${urgentClass}`}>
            <div className="flex items-center gap-1.5">
              <Flame className="size-3.5" />
              <p className="text-[0.95rem] tracking-[0.08em]">{urgentOpen}</p>
            </div>
            <p className="mt-1 text-[0.52rem] uppercase tracking-[0.2em]">
              urgent
            </p>
          </div>
        </div>
      </div>
    </LifePanel>
  );
}

function boardHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "board";
  }
}

const CADENCE_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
  { label: "daily", value: 1440 },
] as const;

function cadenceLabel(minutes: number) {
  return (
    CADENCE_OPTIONS.find((option) => option.value === minutes)?.label ??
    `${minutes} min`
  );
}

export function InspirationPanel() {
  const { config, hydrate, save, clear } = useInspirationStore();
  const [boardUrl, setBoardUrl] = useState("");
  const [cadenceMinutes, setCadenceMinutes] = useState(60);
  const [imageUrlRows, setImageUrlRows] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const cycleKey = useMemo(() => {
    if (!config) return 0;
    const cadenceMs = config.cadenceMinutes * 60_000;
    return Math.floor(Date.now() / cadenceMs);
  }, [config]);
  const boardImagesQuery = useQuery({
    queryKey: ["life", "pinterest", "board-images", config?.boardUrl],
    queryFn: async () => {
      const params = new URLSearchParams({
        boardUrl: config?.boardUrl ?? "",
        maxResults: "50",
      });
      const response = await fetch(
        `/api/integrations/pinterest/board-images?${params.toString()}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Could not load Pinterest board images.",
        );
      }
      const payload = (await response.json()) as {
        images?: Array<{ imageUrl?: unknown }>;
      };
      return (payload.images ?? [])
        .map((image) => image.imageUrl)
        .filter((url): url is string => typeof url === "string");
    },
    enabled: Boolean(config?.boardUrl),
    staleTime: 15 * 60_000,
  });
  const pinterestImages = boardImagesQuery.data ?? [];
  const imagePool =
    pinterestImages.length > 0 ? pinterestImages : (config?.imageUrls ?? []);
  const activeImage =
    imagePool.length > 0 ? imagePool[cycleKey % imagePool.length] : null;

  useMountEffect(() => {
    hydrate();
    const currentConfig = useInspirationStore.getState().config;
    if (currentConfig) {
      setBoardUrl(currentConfig.boardUrl);
      setCadenceMinutes(currentConfig.cadenceMinutes);
      setImageUrlRows(
        currentConfig.imageUrls.map((url) => ({
          id: crypto.randomUUID(),
          url,
        })),
      );
    }
  });

  const saveBoard = () => {
    const nextUrl = boardUrl.trim();
    if (!nextUrl) return;
    const next = {
      boardUrl: nextUrl,
      cadenceMinutes,
      imageUrls: imageUrlRows.map((row) => row.url.trim()).filter(Boolean),
    };
    save(next);
    setIsConfiguring(false);
  };

  const clearBoard = () => {
    setBoardUrl("");
    setCadenceMinutes(60);
    setImageUrlRows([]);
    clear();
  };

  const updateImageUrl = (id: string, value: string) => {
    setImageUrlRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, url: value } : row)),
    );
  };

  const removeImageUrl = (id: string) => {
    setImageUrlRows((rows) => rows.filter((row) => row.id !== id));
  };

  return (
    <LifePanel
      label="// inspiration"
      title="moodboard"
      meta={config ? cadenceLabel(config.cadenceMinutes) : "not configured"}
      action={<ImageIcon className="size-3.5 text-muted-foreground" />}
    >
      <div
        className={`group relative h-full min-h-[17.25rem] overflow-hidden border text-center ${
          config ? "border-border" : "border-dashed border-border p-4"
        }`}
      >
        {config ? (
          <div
            className="absolute inset-0 overflow-hidden bg-background"
            key={`${config.boardUrl}-${cycleKey}`}
          >
            {activeImage ? (
              <a
                href={config.boardUrl}
                target="_blank"
                rel="noreferrer"
                className="block h-full"
                aria-label={`Open ${boardHost(config.boardUrl)}`}
              >
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${activeImage})` }}
                  role="img"
                  aria-label={`Moodboard from ${boardHost(config.boardUrl)}`}
                />
                <div className="absolute inset-x-0 bottom-0 bg-background/80 px-3 py-2 text-left backdrop-blur-sm">
                  <p className={lifeStyles.panelTitle}>
                    {boardHost(config.boardUrl)}
                  </p>
                  <p className={lifeStyles.panelMeta}>
                    image {(cycleKey % imagePool.length) + 1} /{" "}
                    {imagePool.length} / every{" "}
                    {cadenceLabel(config.cadenceMinutes)}
                  </p>
                </div>
              </a>
            ) : (
              <div className="grid h-full place-items-center p-4">
                <div className="max-w-64 space-y-3 text-center">
                  <ImageIcon className="mx-auto size-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className={lifeStyles.panelTitle}>
                      {boardImagesQuery.isLoading
                        ? "loading pinterest"
                        : "no images loaded"}
                    </p>
                    <p className={lifeStyles.panelMeta}>
                      {boardImagesQuery.error instanceof Error
                        ? boardImagesQuery.error.message
                        : "connect pinterest or add direct image urls"}
                    </p>
                  </div>
                  <a
                    href={config.boardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={workspacePageStyles.modalButton}
                  >
                    open board
                  </a>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsConfiguring(true)}
              className="absolute right-2 top-2 flex size-8 items-center justify-center border border-border bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground group-hover:opacity-100"
              aria-label="Configure inspiration board"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="grid h-full place-items-center">
            <div className="space-y-3">
              <ImageIcon className="mx-auto size-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className={lifeStyles.panelTitle}>add board source</p>
                <p className={lifeStyles.panelMeta}>
                  configure pinterest board
                </p>
              </div>
            </div>
          </div>
        )}
        {!config && (
          <div className="absolute inset-x-4 bottom-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfiguring(true)}
                className={workspacePageStyles.modalButton}
              >
                add board
              </button>
            </div>
          </div>
        )}
      </div>

      <WorkspaceDialog
        open={isConfiguring}
        onOpenChange={(open) => setIsConfiguring(open)}
      >
        <DialogHeader className="gap-1">
          <DialogTitle className={workspacePageStyles.cardTitle}>
            inspiration board
          </DialogTitle>
          <DialogDescription className={workspacePageStyles.cardBodyText}>
            configure the board source and direct image URLs to cycle.
          </DialogDescription>
        </DialogHeader>
        <div className={workspacePageStyles.formGroup}>
          <label className={workspacePageStyles.formLabel}>
            <span className={workspacePageStyles.metricLabel}>board url</span>
            <input
              type="url"
              value={boardUrl}
              onChange={(event) => setBoardUrl(event.target.value)}
              placeholder="https://www.pinterest.com/..."
              className={`w-full ${workspacePageStyles.inlineInput}`}
            />
          </label>
          <label className={workspacePageStyles.formLabel}>
            <span className={workspacePageStyles.metricLabel}>
              change cadence
            </span>
            <select
              value={cadenceMinutes}
              onChange={(event) =>
                setCadenceMinutes(Number(event.target.value))
              }
              className={`w-full ${workspacePageStyles.inlineInputSmall}`}
            >
              {CADENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className={workspacePageStyles.metricLabel}>
                image urls
              </span>
              <button
                type="button"
                onClick={() =>
                  setImageUrlRows((rows) => [
                    ...rows,
                    { id: crypto.randomUUID(), url: "" },
                  ])
                }
                className={workspacePageStyles.modalButton}
              >
                add image
              </button>
            </div>
            <div className="max-h-48 space-y-2 overflow-auto">
              {imageUrlRows.length === 0 ? (
                <p className={workspacePageStyles.cardBodyText}>
                  Add direct image URLs copied from pins or another source.
                </p>
              ) : (
                imageUrlRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
                  >
                    <input
                      type="url"
                      value={row.url}
                      onChange={(event) =>
                        updateImageUrl(row.id, event.target.value)
                      }
                      placeholder="https://i.pinimg.com/..."
                      className={`w-full ${workspacePageStyles.inlineInput}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeImageUrl(row.id)}
                      className={lifeStyles.inlineIconButton}
                      aria-label="Delete image URL"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter className={workspaceModalFooterClass}>
            {config && (
              <button
                type="button"
                onClick={() => {
                  clearBoard();
                  setIsConfiguring(false);
                }}
                className={workspacePageStyles.modalDangerButton}
              >
                delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsConfiguring(false)}
              className={workspacePageStyles.modalButton}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={saveBoard}
              disabled={!boardUrl.trim()}
              className={workspacePageStyles.modalButton}
            >
              save board
            </button>
          </DialogFooter>
        </div>
      </WorkspaceDialog>
    </LifePanel>
  );
}

export function EmptyLifePanelText({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmptyTaskText>{children}</EmptyTaskText>;
}
