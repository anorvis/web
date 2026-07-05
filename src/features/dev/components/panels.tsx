"use client";

import { Badge } from "@anorvis/ui/badge";
import { Button } from "@anorvis/ui/button";
import { Card, CardContent, CardHeader } from "@anorvis/ui/card";
import { devStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useRef } from "react";
import {
  CodeBlock,
  FormattedText,
  parsePiSessionTranscript,
} from "@/features/dev/components/text";
import { useDevStore } from "@/features/dev/stores/dev-store";
import {
  DEV_PANEL_HEIGHT,
  type JobRecord,
  jobDisplayStatus,
  type OsEvent,
  preview,
  type RunRecord,
  STREAM_ROW_HEIGHT_PX,
  statusTone,
  streamEventDetails,
} from "@/features/dev/utils/display";
import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  formatEventTime,
  formatRelativeTime,
} from "@/lib/workspace/view-utils";
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={workspacePageStyles.metricCell}>
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <p className={workspacePageStyles.metricValue}>{value}</p>
    </div>
  );
}

export function RunList(props: {
  loading: boolean;
  runs: RunRecord[];
  jobs: JobRecord[];
}) {
  const { selectedRunId, setSelectedRunId } = useDevStore();
  if (props.loading) {
    return <p className={workspacePageStyles.cardBodyText}>loading jobs…</p>;
  }
  if (props.runs.length === 0) {
    return (
      <p className={workspacePageStyles.cardBodyText}>
        no background jobs yet. ask an agent to schedule future work.
      </p>
    );
  }

  return (
    <div className={workspacePageStyles.list}>
      {props.runs.map((run) => {
        const job = run.jobId
          ? (props.jobs.find((entry) => entry.id === run.jobId) ?? null)
          : null;
        const displayStatus = jobDisplayStatus(job, run);
        return (
          <button
            key={run.id}
            type="button"
            className={cn(
              devStyles.runListButton,
              selectedRunId === run.id && devStyles.runListButtonActive,
            )}
            onClick={() => setSelectedRunId(run.id)}
          >
            <div className={devStyles.runListHeader}>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    workspacePageStyles.badgeSmall,
                    statusTone(displayStatus),
                  )}
                >
                  {displayStatus}
                </Badge>
                {selectedRunId === run.id && (
                  <span className={devStyles.tinyMetaForeground}>selected</span>
                )}
              </div>
              <span className={devStyles.tinyMeta}>
                {formatRelativeTime(
                  job?.nextRunAt ?? run.startedAt ?? run.createdAt,
                )}
              </span>
            </div>
            <p className={devStyles.runPreview}>
              {preview(job?.instruction ?? run.instruction)}
            </p>
            <p className={devStyles.runMeta}>
              {run.agent} · {(job?.id ?? run.id).slice(0, 8)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function OsStreamPanel({ events }: { events: OsEvent[] }) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const {
    streamPage: page,
    streamPageSize: pageSize,
    setStreamPage: setPage,
    setStreamPageSize: setPageSize,
  } = useDevStore();
  const pageCount = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const visibleEvents = events.slice(start, start + pageSize);

  useMountEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const updatePageSize = () => {
      const styles = window.getComputedStyle(element);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom);
      const availableHeight = element.clientHeight - verticalPadding;
      const nextPageSize = Math.max(
        1,
        Math.floor(availableHeight / STREAM_ROW_HEIGHT_PX),
      );
      setPageSize(nextPageSize);
    };

    updatePageSize();
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(element);
    window.addEventListener("resize", updatePageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePageSize);
    };
  });

  return (
    <Card
      className={cn(
        workspacePageStyles.card,
        DEV_PANEL_HEIGHT,
        devStyles.panelCard,
      )}
    >
      <CardHeader className={devStyles.panelHeader}>
        <div className={devStyles.panelHeaderRow}>
          <div>
            <p className={workspacePageStyles.cardLabel}>{"// anorvis-os"}</p>
            <p className={workspacePageStyles.cardTitle}>live event stream</p>
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={workspacePageStyles.actionButton}
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ←
              </Button>
              <span className={devStyles.tinyMeta}>
                {safePage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={workspacePageStyles.actionButton}
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
              >
                →
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent ref={contentRef} className={devStyles.panelBodyHidden}>
        {events.length === 0 ? (
          <p className={workspacePageStyles.cardBodyText}>
            waiting for Anorvis OS events…
          </p>
        ) : (
          <div className={devStyles.streamList}>
            {visibleEvents.map((event) => {
              const details = streamEventDetails(event);
              return (
                <StreamLine
                  key={event.id}
                  time={event.createdAt}
                  label={details.label}
                  message={details.message}
                  meta={details.meta}
                  error={
                    event.type.includes("failed") ||
                    event.type.includes("error")
                  }
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StreamLine(props: {
  time: string;
  label: string;
  message: string;
  meta: string;
  error?: boolean;
}) {
  return (
    <div className={devStyles.streamLine}>
      <span className={devStyles.logTime}>[{formatEventTime(props.time)}]</span>
      <span
        className={cn(
          devStyles.logType,
          props.error ? "text-red-400" : "text-foreground",
        )}
      >
        {props.label}
      </span>
      <span className={devStyles.streamMessage}>
        <span className="text-foreground">{props.message}</span>
        {props.meta && <span className="ml-2">{props.meta}</span>}
      </span>
    </div>
  );
}

export function RunDetailPanel(props: {
  run: RunRecord | null;
  job: JobRecord | null;
  events: Array<{ time: string; type: string; message: string }>;
  output: string | null;
  piSession: string | null;
  artifacts: string[];
}) {
  const { detailTab, setDetailTab } = useDevStore();
  return (
    <Card className={cn(workspacePageStyles.card, "flex min-h-0 flex-col")}>
      <CardHeader className={devStyles.detailHeader}>
        <div className={devStyles.detailHeaderRow}>
          <div>
            <p className={workspacePageStyles.cardLabel}>{"// run detail"}</p>
            <p className={workspacePageStyles.cardTitle}>
              {props.run
                ? `${props.run.agent} · ${preview(props.run.instruction, 72)}`
                : "no run selected"}
            </p>
          </div>
          {props.run && (
            <Badge
              variant="outline"
              className={cn(
                workspacePageStyles.badgeSmall,
                statusTone(props.run.status),
              )}
            >
              {props.run.status}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              detailTab === "logs" && "border-foreground text-foreground",
            )}
            onClick={() => setDetailTab("logs")}
          >
            logs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              detailTab === "output" && "border-foreground text-foreground",
            )}
            onClick={() => setDetailTab("output")}
          >
            output
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              workspacePageStyles.actionButton,
              detailTab === "pi" && "border-foreground text-foreground",
            )}
            onClick={() => setDetailTab("pi")}
          >
            pi session
          </Button>
        </div>
      </CardHeader>
      <CardContent className={devStyles.panelBodyScroll}>
        {detailTab === "logs" ? (
          <InlineTerminal
            run={props.run}
            job={props.job}
            events={props.events}
          />
        ) : detailTab === "output" ? (
          <InlineArtifact
            run={props.run}
            output={props.output}
            artifacts={props.artifacts}
          />
        ) : (
          <InlinePiSession run={props.run} piSession={props.piSession} />
        )}
      </CardContent>
    </Card>
  );
}

function InlineTerminal(props: {
  run: RunRecord | null;
  job: JobRecord | null;
  events: Array<{ time: string; type: string; message: string }>;
}) {
  if (!props.run) {
    return (
      <p className={workspacePageStyles.cardBodyText}>
        select a run to inspect logs.
      </p>
    );
  }

  return (
    <div className={devStyles.terminal}>
      <LogLine
        time={props.run.createdAt}
        type="run.selected"
        message={props.run.instruction}
      />
      {props.job && (
        <LogLine
          time={props.job.createdAt}
          type="job.source"
          message={`job=${props.job.id} enabled=${props.job.enabled}`}
        />
      )}
      {props.events.map((event, index) => (
        <LogLine
          key={`${event.time}-${event.type}-${index}`}
          time={event.time}
          type={event.type}
          message={event.message}
        />
      ))}
      {props.run.error && (
        <LogLine
          time={props.run.finishedAt ?? props.run.createdAt}
          type="run.error"
          message={props.run.error}
          error
        />
      )}
    </div>
  );
}

function InlineArtifact(props: {
  run: RunRecord | null;
  output: string | null;
  artifacts: string[];
}) {
  if (!props.run) {
    return (
      <p className={workspacePageStyles.cardBodyText}>
        select a run to view output.
      </p>
    );
  }

  if (!props.output) {
    return (
      <div className={workspacePageStyles.formGroup}>
        <p className={workspacePageStyles.cardBodyText}>no final output yet.</p>
        {props.run.outputPreview && (
          <FormattedText value={props.run.outputPreview} />
        )}
      </div>
    );
  }

  return (
    <div className={workspacePageStyles.formGroup}>
      {props.artifacts.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {props.artifacts.map((artifact) => (
            <div key={artifact} className={workspacePageStyles.metricCell}>
              <p className="break-all text-[0.65rem] text-foreground">
                {artifact}
              </p>
            </div>
          ))}
        </div>
      )}
      <FormattedText value={props.output} />
    </div>
  );
}

function InlinePiSession(props: {
  run: RunRecord | null;
  piSession: string | null;
}) {
  if (!props.run) {
    return (
      <p className={workspacePageStyles.cardBodyText}>
        select a run to view the Pi session.
      </p>
    );
  }

  if (!props.piSession) {
    return (
      <div className={workspacePageStyles.list}>
        <p className={workspacePageStyles.cardBodyText}>
          no Pi session file is available yet.
        </p>
        <p className={workspacePageStyles.cardBodyText}>
          expected session id: {props.run.piSessionId ?? props.run.id}
        </p>
      </div>
    );
  }

  const transcript = parsePiSessionTranscript(props.piSession);
  if (transcript.length === 0) {
    return <CodeBlock value={props.piSession} />;
  }

  return (
    <div className={devStyles.transcript}>
      {transcript.map((entry) => {
        const isJobTrigger =
          Boolean(props.run?.jobId) &&
          entry.role === "user" &&
          entry.content.trim() === props.run?.instruction.trim();
        return (
          <div
            key={entry.id}
            className={cn(
              devStyles.transcriptCard,
              entry.role === "assistant" &&
                "border-foreground/25 bg-foreground/[0.03]",
              entry.role === "user" && "bg-background",
              entry.role === "toolResult" && "border-border/70 bg-muted/20",
              isJobTrigger &&
                "border-amber-600/40 bg-amber-500/10 dark:border-amber-500/50",
              entry.isError &&
                "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:text-rose-200",
            )}
          >
            <div className={devStyles.transcriptHeader}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    workspacePageStyles.badgeSmall,
                    entry.isError
                      ? statusTone("error")
                      : isJobTrigger
                        ? statusTone("queued")
                        : entry.role === "assistant"
                          ? statusTone("running")
                          : entry.role === "toolResult"
                            ? statusTone("queued")
                            : statusTone("idle"),
                  )}
                >
                  {isJobTrigger ? "job trigger" : entry.label}
                </Badge>
                {isJobTrigger && (
                  <span className="text-[0.55rem] uppercase tracking-[0.25em] text-amber-700 dark:text-amber-200">
                    scheduled job instruction
                  </span>
                )}
              </div>
              {entry.timestamp && (
                <span className={devStyles.tinyMeta}>
                  {formatEventTime(entry.timestamp)}
                </span>
              )}
            </div>
            <FormattedText value={entry.content} />
          </div>
        );
      })}
    </div>
  );
}

function LogLine(props: {
  time: string;
  type: string;
  message: string;
  error?: boolean;
}) {
  return (
    <div className={devStyles.logLine}>
      <span className={devStyles.logTime}>[{formatEventTime(props.time)}]</span>
      <span
        className={cn(
          devStyles.logType,
          props.error ? "text-red-400" : "text-foreground",
        )}
      >
        {props.type}
      </span>
      <span className={devStyles.logMessage}>
        <FormattedText value={props.message} />
      </span>
    </div>
  );
}
