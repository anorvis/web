"use client";

import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useMemo, useRef, useState } from "react";
import { ContextPanel } from "@/features/dev/components/context-panel";
import { MemoryPanel } from "@/features/dev/components/memory-panel";
import {
  Metric,
  OsStreamPanel,
  RunDetailPanel,
  RunList,
} from "@/features/dev/components/panels";
import { useDevStore } from "@/features/dev/stores/dev-store";
import {
  DEV_PANEL_HEIGHT,
  formatPayload,
  type JobRecord,
  type MemoryDocument,
  type MemoryGraph,
  type OsEvent,
  type RunRecord,
} from "@/features/dev/utils/display";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { isApiError } from "@/lib/effect/errors";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import { decodeUnknownResult } from "@/lib/effect/schema";
import { isRecord } from "@/lib/guards";
import { queryKeys } from "@/lib/query/keys";

type RunLogEvent = {
  type: string;
  message?: string;
  payload?: unknown;
  createdAt: string;
};

const OsEventMessageSchema = Schema.parseJson(
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

type DashboardState = {
  jobs: JobRecord[];
  runs: RunRecord[];
  logs: RunLogEvent[];
  osEvents: OsEvent[];
  memories: MemoryDocument[];
  memoryGraph: MemoryGraph | null;
  output: string | null;
  piSession: string | null;
  loading: boolean;
  refreshing: boolean;
  sseStatus: "connecting" | "connected" | "fallback";
  error: string | null;
};

async function fetchJson<T>(path: string): Promise<T> {
  return runEffect(requestJson<T>(path, { cache: "no-store" }));
}

async function fetchOptionalPiSession(path: string): Promise<string | null> {
  try {
    const payload = await fetchJson<{ content: string }>(path);
    return payload.content;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

function statusCount(records: RunRecord[], status: string) {
  return records.filter((record) => record.status === status).length;
}

function memoryPurpose(memory: MemoryDocument) {
  if (memory.kind === "profile") return "adaptive";
  if (memory.kind === "semantic" || memory.kind === "fact") return "knowledge";
  if (memory.kind === "procedural") return "workflows";
  if (memory.kind === "episodic" || memory.kind === "summary") return "history";
  if (memory.kind === "decisions" || memory.kind === "decision") {
    return "decisions";
  }
  return "knowledge";
}

function memoryPurposeOrder(memory: MemoryDocument) {
  switch (memoryPurpose(memory)) {
    case "adaptive":
      return 0;
    case "knowledge":
      return 1;
    case "workflows":
      return 2;
    case "history":
      return 3;
    case "decisions":
      return 4;
    default:
      return 5;
  }
}

function extractArtifactRefs(output: string | null): string[] {
  if (!output) return [];
  return Array.from(
    new Set(output.match(/(?:\/tmp|~|\.)\/[^\s`'")]+/g) ?? []),
  ).slice(0, 6);
}

function parseOsEvent(event: MessageEvent<string>): OsEvent {
  const decoded = decodeUnknownResult(OsEventMessageSchema, event.data);
  if (decoded.ok) {
    const value = decoded.value;
    return {
      id:
        typeof value.id === "number" || typeof value.id === "string"
          ? `${event.type}-${value.id}`
          : `${event.type}-${Date.now().toString()}`,
      type: typeof value.type === "string" ? value.type : event.type,
      payload: "payload" in value ? value.payload : value,
      createdAt:
        typeof value.createdAt === "string"
          ? value.createdAt
          : new Date().toISOString(),
    };
  }

  return {
    id: `${event.type}-${Date.now().toString()}`,
    type: event.type,
    payload: event.data,
    createdAt: new Date().toISOString(),
  };
}

function normalizeObservabilityEvents(events: unknown[]): OsEvent[] {
  const normalized: OsEvent[] = [];
  for (const [index, event] of events.entries()) {
    if (!isRecord(event)) continue;
    const time = typeof event.time === "string" ? event.time : null;
    const name = typeof event.event === "string" ? event.event : null;
    if (!time || !name) continue;
    normalized.push({
      id: `observability.log-${time}-${name}-${index}`,
      type: "observability.log",
      payload: event,
      createdAt: time,
    });
  }
  return normalized.reverse();
}

function mergeOsEvents(liveEvents: OsEvent[], historyEvents: OsEvent[]) {
  const seen = new Set<string>();
  return [...liveEvents, ...historyEvents]
    .filter((event) => {
      const key =
        event.type === "observability.log" && isRecord(event.payload)
          ? [
              event.type,
              event.createdAt,
              event.payload.event,
              event.payload.message,
            ].join(":")
          : event.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 500);
}

export function DevPlatformDashboard() {
  const queryClient = useQueryClient();
  const isMounted = useHasMounted();
  const [error, setError] = useState<string | null>(null);
  const [selectedMemoryKey, setSelectedMemoryKey] = useState<string | null>(
    null,
  );
  const {
    selectedRunId: storedSelectedRunId,
    activeTab,
    detailTab,
    sseStatus,
    liveOsEvents,
    setSelectedRunId,
    setActiveTab,
    setSseStatus,
    addLiveOsEvent,
  } = useDevStore();
  const selectedRunIdRef = useRef<string | null>(null);
  const detailTabRef = useRef(detailTab);
  const activeTabRef = useRef(activeTab);
  const refreshInFlightRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  activeTabRef.current = activeTab;
  detailTabRef.current = detailTab;

  const jobsQuery = useQuery({
    queryKey: queryKeys.dev.jobs(),
    queryFn: () => fetchJson<JobRecord[]>("/api/dev/jobs"),
    refetchInterval: 30_000,
    enabled: activeTab === "jobs",
  });
  const runsQuery = useQuery({
    queryKey: queryKeys.dev.runs(),
    queryFn: () => fetchJson<RunRecord[]>("/api/dev/runs"),
    refetchInterval: 30_000,
    enabled: activeTab === "jobs",
  });
  const jobs = isMounted ? (jobsQuery.data ?? []) : [];
  const runs = isMounted ? (runsQuery.data ?? []) : [];
  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [runs],
  );
  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );
  const selectedRunId = storedSelectedRunId ?? sortedRuns[0]?.id ?? null;
  selectedRunIdRef.current = selectedRunId;
  const selectedRun = useMemo(
    () => sortedRuns.find((run) => run.id === selectedRunId) ?? null,
    [selectedRunId, sortedRuns],
  );
  const logsQuery = useQuery({
    queryKey: selectedRunId
      ? queryKeys.dev.logs(selectedRunId)
      : ["dev", "runs", "none", "logs"],
    queryFn: () =>
      fetchJson<{ events: RunLogEvent[] }>(
        `/api/dev/runs/${encodeURIComponent(selectedRunId ?? "")}/logs`,
      ),
    enabled: Boolean(selectedRunId),
    placeholderData: (previous) => previous,
  });
  const outputQuery = useQuery({
    queryKey: selectedRunId
      ? queryKeys.dev.output(selectedRunId)
      : ["dev", "runs", "none", "output"],
    queryFn: () =>
      fetchJson<{ output: string }>(
        `/api/dev/runs/${encodeURIComponent(selectedRunId ?? "")}/output`,
      ),
    enabled: Boolean(
      selectedRunId &&
        (selectedRun?.status === "succeeded" || selectedRun?.outputPreview),
    ),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const piSessionQuery = useQuery({
    queryKey: selectedRunId
      ? queryKeys.dev.piSession(selectedRunId)
      : ["dev", "runs", "none", "pi-session"],
    queryFn: () =>
      fetchOptionalPiSession(
        `/api/dev/runs/${encodeURIComponent(selectedRunId ?? "")}/pi-session`,
      ),
    enabled: Boolean(selectedRunId && detailTab === "pi"),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const osEventsQuery = useQuery({
    queryKey: queryKeys.dev.osEvents(),
    queryFn: () => fetchJson<unknown[]>("/api/dev/os-events"),
    select: normalizeObservabilityEvents,
    staleTime: 0,
    enabled: activeTab === "stream",
    refetchOnMount: "always",
  });
  const memoriesQuery = useQuery({
    queryKey: queryKeys.dev.memories(),
    queryFn: () => fetchJson<MemoryDocument[]>("/api/dev/memories"),
    enabled: activeTab === "memory",
    placeholderData: (previous) => previous,
  });
  const memoryGraphQuery = useQuery({
    queryKey: queryKeys.dev.memoryGraph(),
    queryFn: () => fetchJson<MemoryGraph>("/api/dev/memories?view=graph"),
    enabled: activeTab === "memory",
    placeholderData: (previous) => previous,
  });
  const osEvents = useMemo(
    () =>
      isMounted ? mergeOsEvents(liveOsEvents, osEventsQuery.data ?? []) : [],
    [isMounted, liveOsEvents, osEventsQuery.data],
  );

  const state: DashboardState = {
    jobs: sortedJobs,
    runs: sortedRuns,
    logs: isMounted ? (logsQuery.data?.events ?? []) : [],
    osEvents,
    memories: isMounted ? (memoriesQuery.data ?? []) : [],
    memoryGraph: isMounted ? (memoryGraphQuery.data ?? null) : null,
    output: isMounted ? (outputQuery.data?.output ?? null) : null,
    piSession: isMounted ? (piSessionQuery.data ?? null) : null,
    loading:
      activeTab === "jobs" &&
      (!isMounted || jobsQuery.isLoading || runsQuery.isLoading),
    refreshing:
      activeTab === "jobs" &&
      (jobsQuery.isFetching ||
        runsQuery.isFetching ||
        logsQuery.isFetching ||
        outputQuery.isFetching ||
        piSessionQuery.isFetching),
    sseStatus: isMounted ? sseStatus : "connecting",
    error:
      activeTab === "jobs" && isMounted && error
        ? error
        : activeTab === "jobs" && isMounted && jobsQuery.error instanceof Error
          ? jobsQuery.error.message
          : activeTab === "jobs" &&
              isMounted &&
              runsQuery.error instanceof Error
            ? runsQuery.error.message
            : activeTab === "jobs" &&
                isMounted &&
                logsQuery.error instanceof Error
              ? logsQuery.error.message
              : null,
  };
  const sortedMemories = useMemo(
    () =>
      [...state.memories].sort((a, b) =>
        `${memoryPurposeOrder(a)}:${a.kind}/${a.id}`.localeCompare(
          `${memoryPurposeOrder(b)}:${b.kind}/${b.id}`,
        ),
      ),
    [state.memories],
  );
  const selectedMemory = selectedMemoryKey
    ? (sortedMemories.find(
        (memory) => `${memory.kind}/${memory.id}` === selectedMemoryKey,
      ) ??
      state.memories.find(
        (memory) => `${memory.kind}/${memory.id}` === selectedMemoryKey,
      ) ??
      null)
    : null;

  const backgroundRuns = useMemo(
    () => state.runs.filter((run) => run.jobId),
    [state.runs],
  );
  const selectedJobRun = selectedRun?.jobId
    ? selectedRun
    : (backgroundRuns[0] ?? null);
  const selectedJob = useMemo(
    () =>
      selectedJobRun?.jobId
        ? (state.jobs.find((job) => job.id === selectedJobRun.jobId) ?? null)
        : null,
    [selectedJobRun, state.jobs],
  );
  const artifacts = useMemo(
    () => extractArtifactRefs(state.output),
    [state.output],
  );
  const recentEvents = useMemo(
    () =>
      state.logs.slice(-80).map((event) => ({
        time: event.createdAt,
        type: event.type,
        message: event.message
          ? `${event.message} ${formatPayload(event.payload)}`
          : formatPayload(event.payload),
      })),
    [state.logs],
  );

  const refresh = async () => {
    if (refreshInFlightRef.current) {
      refreshAgainRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const requestedTab = activeTabRef.current;
      if (requestedTab === "operations") {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dev.context(),
        });
      } else if (requestedTab === "memory") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dev.memories() }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.dev.memoryGraph(),
          }),
        ]);
      } else if (requestedTab === "stream") {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dev.osEvents(),
        });
      } else {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dev.jobs() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dev.runs() }),
        ]);
        const requestedRunId = selectedRunIdRef.current;
        if (requestedRunId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.dev.logs(requestedRunId),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.dev.output(requestedRunId),
          });
          if (detailTabRef.current === "pi") {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.dev.piSession(requestedRunId),
            });
          }
        }
      }
      setSseStatus("connected");
      setError(null);
    } catch (error) {
      setSseStatus(sseStatus === "connected" ? "connected" : "fallback");
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      refreshInFlightRef.current = false;
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false;
        void refresh();
      }
    }
  };

  useMountEffect(() => {
    void refresh();
    const events = new EventSource("/api/events");
    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void refresh();
      }, 250);
    };
    events.onopen = () => setSseStatus("connected");
    events.onerror = () => setSseStatus("fallback");
    const appendOsEvent = (event: MessageEvent<string>) => {
      const parsed = parseOsEvent(event);
      const eventRunId =
        isRecord(parsed.payload) && typeof parsed.payload.runId === "string"
          ? parsed.payload.runId
          : null;
      const runLogEvent =
        parsed.type === "run.log.appended" &&
        isRecord(parsed.payload) &&
        isRecord(parsed.payload.event) &&
        typeof parsed.payload.event.type === "string" &&
        typeof parsed.payload.event.createdAt === "string"
          ? ({
              type: parsed.payload.event.type,
              message:
                typeof parsed.payload.event.message === "string"
                  ? parsed.payload.event.message
                  : undefined,
              payload: parsed.payload.event.payload,
              createdAt: parsed.payload.event.createdAt,
            } satisfies RunLogEvent)
          : null;
      addLiveOsEvent(parsed);
      if (
        runLogEvent &&
        typeof eventRunId === "string" &&
        eventRunId === selectedRunIdRef.current
      ) {
        queryClient.setQueryData<{ events: RunLogEvent[] }>(
          queryKeys.dev.logs(eventRunId),
          (current) => ({ events: [...(current?.events ?? []), runLogEvent] }),
        );
      }
      if (
        (parsed.type !== "run.log.appended" &&
          parsed.type !== "observability.log") ||
        (eventRunId === selectedRunIdRef.current && !runLogEvent)
      ) {
        scheduleRefresh();
      }
    };
    const eventTypes = [
      "run.created",
      "run.started",
      "run.log.appended",
      "run.succeeded",
      "run.failed",
      "session.created",
      "session.message.created",
      "toolkit.operation.called",
      "agent.trace.started",
      "agent.trace.finished",
      "agent.trace.failed",
      "observability.log",
      "gateway.error",
    ];
    events.onmessage = appendOsEvent;
    for (const type of eventTypes) {
      events.addEventListener(type, appendOsEvent);
    }
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      for (const type of eventTypes) {
        events.removeEventListener(type, appendOsEvent);
      }
      events.close();
    };
  });

  return (
    <div className="space-y-4">
      {activeTab !== "operations" ? (
        <div className={workspacePageStyles.metricsStrip}>
          <Metric
            label="anorvis-os"
            value={state.error ? "degraded" : "online"}
          />
          <Metric
            label="running"
            value={String(statusCount(state.runs, "running"))}
          />
          <Metric
            label="queued"
            value={String(
              statusCount(state.runs, "queued") +
                state.jobs.filter(
                  (job) =>
                    job.status === "idle" &&
                    job.enabled &&
                    job.nextRunAt &&
                    Date.parse(job.nextRunAt) <= Date.now(),
                ).length,
            )}
          />
          <Metric
            label="done"
            value={String(statusCount(state.runs, "succeeded"))}
          />
          <Metric label="sse" value={state.sseStatus} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              activeTab === "operations" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("operations")}
          >
            operations
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              activeTab === "stream" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("stream")}
          >
            stream
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              activeTab === "jobs" && "border-foreground text-foreground",
            )}
            onClick={() => {
              setActiveTab("jobs");
              if (!selectedRun?.jobId) {
                const firstBackgroundRunId = backgroundRuns[0]?.id ?? null;
                selectedRunIdRef.current = firstBackgroundRunId;
                setSelectedRunId(firstBackgroundRunId);
              }
            }}
          >
            jobs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              activeTab === "memory" && "border-foreground text-foreground",
            )}
            onClick={() => setActiveTab("memory")}
          >
            memory
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={workspacePageStyles.actionButton}
          onClick={() => void refresh()}
        >
          refresh
        </Button>
      </div>

      {state.error && (
        <Card className={workspacePageStyles.card}>
          <CardContent className={workspacePageStyles.cardBody}>
            <p className={workspacePageStyles.errorText}>{state.error}</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "operations" ? (
        <ContextPanel />
      ) : activeTab === "jobs" ? (
        <div
          className={cn(
            "grid items-stretch gap-4 lg:grid-cols-[340px_minmax(0,1fr)]",
            DEV_PANEL_HEIGHT,
          )}
        >
          <Card
            className={cn(workspacePageStyles.card, "flex min-h-0 flex-col")}
          >
            <CardHeader className="space-y-1 border-b border-border px-4 py-3">
              <p className={workspacePageStyles.cardLabel}>{"// jobs"}</p>
              <p className={workspacePageStyles.cardTitle}>background queue</p>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <RunList
                loading={state.loading}
                runs={backgroundRuns}
                jobs={state.jobs}
              />
            </CardContent>
          </Card>

          <RunDetailPanel
            run={selectedJobRun}
            job={selectedJob}
            events={recentEvents}
            output={state.output}
            piSession={state.piSession}
            artifacts={artifacts}
          />
        </div>
      ) : activeTab === "memory" ? (
        <MemoryPanel
          documents={sortedMemories}
          allDocuments={state.memories}
          graph={state.memoryGraph}
          loading={memoriesQuery.isLoading || memoryGraphQuery.isLoading}
          refreshing={memoriesQuery.isFetching || memoryGraphQuery.isFetching}
          selectedDocument={selectedMemory}
          onSelect={(document) =>
            setSelectedMemoryKey(
              document ? `${document.kind}/${document.id}` : null,
            )
          }
        />
      ) : (
        <OsStreamPanel events={state.osEvents} />
      )}
    </div>
  );
}
