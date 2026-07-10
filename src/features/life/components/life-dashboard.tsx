"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Maximize2, Pause, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  WorkspaceCard,
  WorkspaceMetricButton,
} from "@/components/layout/workspace";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
} from "@/components/layout/workspace-dialog";
import {
  AddSourceButton,
  Section,
} from "@/components/life-intelligence/record-ui";
import {
  completeTask,
  deleteTask,
  fetchCalendarEvents,
  fetchLifeSnapshot,
} from "@/features/life/api/life";
import { CalendarView } from "@/features/life/components/calendar-view";
import {
  blockInRange,
  calendarEventMatchesFilters,
  plannedSessionKeys,
  rangeFor,
  sessionBlockKey,
} from "@/features/life/components/life-dashboard-calculations";
import {
  FocusSessionList,
  TagsDialog,
  TodoDialog,
} from "@/features/life/components/life-dashboard-modals";
import { useLifeTagCatalog } from "@/features/life/components/life-dashboard-tags";
import * as LifeUi from "@/features/life/components/life-dashboard-ui";
import {
  calendarQueryKey,
  calendarRangeParams,
} from "@/features/life/lib/calendar-query";
import { useLifeStore } from "@/features/life/stores/life-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { lifeFromSources } from "@/lib/life-intelligence/adapters";
import {
  getBlockStart,
  openTodos,
  sessionMinutes,
  timeBlocksToCalendarEvents,
} from "@/lib/life-intelligence/derive";
import type { Session } from "@/lib/life-intelligence/model";
import { LOCAL_FOCUS_SESSION_ID_PREFIX } from "@/lib/life-intelligence/model";
import { queryKeys } from "@/lib/query/keys";

export function LifeDashboard() {
  const selectedDate = useLifeStore((state) => state.selectedDate);
  const setSelectedDate = useLifeStore((state) => state.setSelectedDate);
  const calendarMode = useLifeStore((state) => state.calendarMode);
  const dismissedFocusSessionIds = useLifeStore(
    (state) => state.dismissedFocusSessionIds,
  );
  const dismissFocusSession = useLifeStore(
    (state) => state.dismissFocusSession,
  );
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerTitle, setTimerTitle] = useState("focus session");
  const [timerMode, setTimerMode] = useState<LifeUi.TimerMode>("free");
  const [timerNotes, setTimerNotes] = useState("");
  const [timerTagIds, setTimerTagIds] = useState<string[]>([]);
  const [pomodoroConfig, setPomodoroConfig] = useState<LifeUi.PomodoroConfig>(
    LifeUi.defaultPomodoroConfig,
  );
  const [timerFullscreen, setTimerFullscreen] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [localSessions, setLocalSessions] = useState<Session[]>([]);
  const [activeModal, setActiveModal] = useState<LifeUi.DetailModal>(null);
  const [todoView, setTodoView] = useState<LifeUi.TodoView>("list");
  const [focusView, setFocusView] = useState<LifeUi.FocusView>("list");
  const todayRef = useRef(new Date());
  const queryClient = useQueryClient();
  const completeTodoMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    },
  });
  const deleteTodoMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    },
  });

  useMountEffect(() => {
    if (selectedDate.getTime() === 0) setSelectedDate(new Date());
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  });

  const effectiveDate =
    selectedDate.getTime() === 0 ? new Date() : selectedDate;
  const selectedRange = useMemo(
    () => rangeFor(effectiveDate, calendarMode),
    [effectiveDate, calendarMode],
  );
  const snapshotQuery = usePersistedQuery({
    queryKey: queryKeys.life.snapshot(),
    queryFn: fetchLifeSnapshot,
  });
  const calendarQuery = useQuery({
    queryKey: calendarQueryKey(calendarMode, effectiveDate),
    queryFn: () =>
      fetchCalendarEvents(calendarRangeParams(effectiveDate, calendarMode)),
    staleTime: 15 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

  const calendarEventsForLife = useMemo(() => {
    const queuedTaskIds = new Set(
      snapshotQuery.hydratedData?.queue.map((task) => task.id) ?? [],
    );
    return (calendarQuery.data ?? []).filter(
      (event) =>
        event.type !== "taskDeadline" ||
        !event.taskId ||
        !queuedTaskIds.has(event.taskId),
    );
  }, [calendarQuery.data, snapshotQuery.hydratedData]);
  const sourcePlannedSessionKeys = useMemo(
    () => plannedSessionKeys(calendarEventsForLife),
    [calendarEventsForLife],
  );
  const sourceLife = useMemo(
    () =>
      lifeFromSources({
        snapshot: snapshotQuery.hydratedData,
        calendarEvents: calendarEventsForLife,
      }),
    [calendarEventsForLife, snapshotQuery.hydratedData],
  );
  const {
    tags,
    loading: tagsLoading,
    tagById,
    selectedTagIds,
    setSelectedTagIds,
    draftTag,
    setDraftTag,
    addTag,
    tagEdit,
    setTagEdit,
    saveTagEdit,
    removeSelectedTags,
    busy: tagBusy,
    error: tagError,
  } = useLifeTagCatalog();

  const life = useMemo(() => {
    const dismissedFocusSessionIdSet = new Set(dismissedFocusSessionIds);
    const localSessionIdSet = new Set(
      localSessions.map((session) => session.id),
    );
    const sourceTimeBlocks = sourceLife.timeBlocks.filter((block) => {
      if (block.type !== "session") return true;
      if (
        dismissedFocusSessionIdSet.has(block.id) ||
        localSessionIdSet.has(block.id)
      ) {
        return false;
      }
      const taskId = block.todoIds[0];
      if (!taskId || block.id !== `session-${taskId}`) return true;
      const blockKey = sessionBlockKey(block);
      return !blockKey || !sourcePlannedSessionKeys.has(blockKey);
    });
    return {
      ...sourceLife,
      tags,
      timeBlocks: [
        ...sourceTimeBlocks,
        ...localSessions.filter(
          (session) => !dismissedFocusSessionIdSet.has(session.id),
        ),
      ],
    };
  }, [
    sourceLife,
    dismissedFocusSessionIds,
    localSessions,
    sourcePlannedSessionKeys,
    tags,
  ]);

  const tagNames = useMemo(
    () => new Map(life.tags.map((tag) => [tag.id, tag.name])),
    [life.tags],
  );

  const calendarEvents = useMemo(() => {
    const sourceEvents = calendarQuery.data ?? [];
    const sourceEventIds = new Set(sourceEvents.map((event) => event.id));
    const sourceDeadlineTaskIds = new Set(
      sourceEvents
        .filter((event) => event.type === "taskDeadline" && event.taskId)
        .map((event) => event.taskId as string),
    );
    const sourcePlannedSessionKeys = plannedSessionKeys(sourceEvents);
    const generatedEvents = timeBlocksToCalendarEvents({
      ...life,
      timeBlocks: life.timeBlocks.filter((block) => {
        if (sourceEventIds.has(block.id)) return false;
        if (block.type === "todo") {
          return !!block.dueAt && !sourceDeadlineTaskIds.has(block.id);
        }
        if (block.type === "session") {
          const blockKey = sessionBlockKey(block);
          return !blockKey || !sourcePlannedSessionKeys.has(blockKey);
        }
        return true;
      }),
    });
    const colorByTagName = new Map(
      life.tags.map((tag) => [tag.name.toLowerCase(), tag.color ?? null]),
    );
    return [...sourceEvents, ...generatedEvents]
      .filter((event) =>
        calendarEventMatchesFilters(event, selectedTagIds, tagById),
      )
      .map((event) => ({
        ...event,
        tagColor: event.tag
          ? (colorByTagName.get(event.tag.toLowerCase()) ?? event.tagColor)
          : event.tagColor,
      }));
  }, [calendarQuery.data, life, selectedTagIds, tagById]);

  const blocks = useMemo(
    () =>
      [...life.timeBlocks].sort((a, b) => getBlockStart(a) - getBlockStart(b)),
    [life.timeBlocks],
  );
  const periodBlocks = useMemo(
    () =>
      blocks.filter((block) =>
        blockInRange(block, selectedRange.start, selectedRange.end),
      ),
    [blocks, selectedRange],
  );
  const todos = openTodos(life);
  const periodTodos = todos.filter((todo) =>
    blockInRange(todo, selectedRange.start, selectedRange.end),
  );
  const sessions = periodBlocks.filter(
    (block): block is Session => block.type === "session",
  );
  const filterNames = selectedTagIds
    .map((id) => tagById.get(id)?.name)
    .filter(Boolean) as string[];
  const filterNote = filterNames.length
    ? `filter: ${filterNames.slice(0, 2).join(", ")}${filterNames.length > 2 ? ` +${filterNames.length - 2}` : ""}`
    : "no filters";
  const tagIdForName = (name: string) =>
    life.tags.find((tag) => tag.name === name)?.id ??
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const tagNameForId = (id: string) =>
    life.tags.find((tag) => tag.id === id)?.name ?? id;
  const snapshotError = snapshotQuery.isError && !snapshotQuery.hydratedData;
  const calendarError = calendarQuery.isError;
  const snapshotLoading = snapshotQuery.hydrationLoading;
  const hasGoogleCalendarSource =
    snapshotQuery.hydratedData?.googleCalendarStatus === "connected" ||
    calendarQuery.data?.some((event) => event.source === "google-calendar");
  const connectedSources = [
    "local calendar",
    ...(hasGoogleCalendarSource ? ["google calendar"] : []),
  ];

  const startTimer = (input?: {
    title?: string;
    notes?: string;
    tag?: string;
    mode?: LifeUi.TimerMode;
    pomodoro?: LifeUi.PomodoroConfig;
  }) => {
    const timerTagId = input?.tag ? tagIdForName(input.tag) : null;
    setTimerTitle(input?.title?.trim() || "focus session");
    setTimerMode(input?.mode ?? timerMode);
    setTimerNotes(input?.notes?.trim() ?? "");
    setTimerTagIds(timerTagId ? [timerTagId] : []);
    if (input?.pomodoro) setPomodoroConfig(input.pomodoro);
    setTimerStartedAt(new Date().toISOString());
    setTimerFullscreen(false);
    setActiveModal(null);
  };

  const stopTimer = () => {
    if (!timerStartedAt) return;
    const stoppedAt = new Date().toISOString();
    setLocalSessions((current) => [
      ...current,
      {
        id: `${LOCAL_FOCUS_SESSION_ID_PREFIX}${Date.now()}`,
        type: "session",
        title: timerTitle,
        tagIds: timerTagIds,
        startAt: timerStartedAt,
        endAt: stoppedAt,
        createdAt: timerStartedAt,
        updatedAt: stoppedAt,
        todoIds: [],
        notes: timerNotes || undefined,
        mode: "focus",
      },
    ]);
    setTimerStartedAt(null);
    setTimerFullscreen(false);
    setTimerNotes("");
    setTimerTagIds([]);
  };

  const closeDetailModal = (open: boolean) => {
    if (!open) setActiveModal(null);
  };

  return (
    <div className="space-y-4">
      {snapshotError ? (
        <WorkspaceCard>
          <div className="space-y-2 p-4">
            <p className={workspacePageStyles.cardLabel}>{"// life"}</p>
            <p className={workspacePageStyles.cardBodyText}>
              couldn't load life snapshot
            </p>
          </div>
        </WorkspaceCard>
      ) : snapshotLoading ? (
        <WorkspaceCard>
          <CalendarView
            hasCalendar
            today={todayRef.current}
            events={[]}
            tasks={[]}
            tagOptions={[]}
          />
        </WorkspaceCard>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <WorkspaceMetricButton
              label="blocks"
              value={`${periodBlocks.length}`}
              note={`events + due todos + sessions · selected ${calendarMode}`}
              onClick={() => setActiveModal("blocks")}
            />
            <WorkspaceMetricButton
              label="todos"
              value={`${todos.length}`}
              note={`${periodTodos.length} due in selected ${calendarMode}`}
              onClick={() => {
                setTodoView("list");
                setActiveModal("todos");
              }}
              action={
                <button
                  type="button"
                  aria-label="add todo"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTodoView("create");
                    setActiveModal("todos");
                  }}
                  className="grid size-8 place-items-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  +
                </button>
              }
            />
            <WorkspaceMetricButton
              label="focus"
              value={
                timerStartedAt
                  ? LifeUi.timerLabel(
                      timerStartedAt,
                      clockNow,
                      timerMode,
                      pomodoroConfig,
                    )
                  : `${Math.round(sessionMinutes({ ...life, timeBlocks: periodBlocks }))}m`
              }
              note={
                timerStartedAt
                  ? `${LifeUi.timerPhaseLabel(
                      timerStartedAt,
                      clockNow,
                      timerMode,
                      pomodoroConfig,
                    )} · ${timerMode}`
                  : `${sessions.length} sessions · selected ${calendarMode}`
              }
              onClick={() => {
                setFocusView("list");
                setActiveModal("focus");
              }}
              action={
                <div className="flex gap-1">
                  {timerStartedAt && (
                    <button
                      type="button"
                      aria-label="fullscreen focus timer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setTimerFullscreen(true);
                      }}
                      className="grid size-8 place-items-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    >
                      <Maximize2 className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={
                      timerStartedAt
                        ? "pause focus session"
                        : "start focus session"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      if (timerStartedAt) stopTimer();
                      else startTimer();
                    }}
                    className="grid size-8 place-items-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  >
                    {timerStartedAt ? (
                      <Pause className="size-3" />
                    ) : (
                      <Play className="size-3" />
                    )}
                  </button>
                </div>
              }
            />
            <WorkspaceMetricButton
              label="tags"
              value={tagsLoading ? "..." : `${life.tags.length}`}
              note={filterNote}
              onClick={() => setActiveModal("tags")}
            />
          </section>

          <WorkspaceCard>
            {calendarError ? (
              <div className="space-y-2 p-4">
                <p className={workspacePageStyles.cardLabel}>{"// calendar"}</p>
                <p className={workspacePageStyles.cardBodyText}>
                  couldn't load calendar events
                </p>
              </div>
            ) : (
              <CalendarView
                hasCalendar
                today={todayRef.current}
                events={calendarEvents}
                tasks={snapshotQuery.hydratedData?.queue ?? []}
                tagOptions={life.tags.map((tag) => tag.name)}
              />
            )}
          </WorkspaceCard>
        </>
      )}

      <Section
        label="sources"
        title="calendar setup"
        headerExtra={<AddSourceButton domain="life" />}
      >
        <p className={workspacePageStyles.cardBodyText}>
          Add Google Calendar or local sources here. Blocks above count dated
          events, due todos, and focus sessions in the selected {calendarMode}.
          Todos count open queue tasks due in that same range.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
            sources
          </span>
          {connectedSources.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-foreground"
            >
              <span className="text-emerald-500">●</span>
              {source} connected
            </span>
          ))}
        </div>
      </Section>

      <LifeUi.BlocksDialog
        open={activeModal === "blocks"}
        onOpenChange={closeDetailModal}
        calendarMode={calendarMode}
        periodBlocks={periodBlocks}
        clockNow={clockNow}
        tagNames={tagNames}
        calendarEvents={calendarEvents}
        tagOptions={life.tags.map((tag) => tag.name)}
      />

      <TodoDialog
        open={activeModal === "todos"}
        onOpenChange={closeDetailModal}
        calendarMode={calendarMode}
        todos={todos}
        periodTodosCount={periodTodos.length}
        queue={snapshotQuery.hydratedData?.queue ?? []}
        view={todoView}
        onViewChange={setTodoView}
        onComplete={(id) => void completeTodoMutation.mutateAsync(id)}
        onDelete={(id) => void deleteTodoMutation.mutateAsync(id)}
        completePending={completeTodoMutation.isPending}
        deletePending={deleteTodoMutation.isPending}
      />

      <WorkspaceDialog
        open={activeModal === "focus"}
        onOpenChange={closeDetailModal}
        className={LifeUi.modalClass}
      >
        <WorkspaceModalFrame
          title="focus"
          description={`Focus sessions for the selected ${calendarMode}. Start closes this modal and returns to the calendar.`}
        >
          <div className="flex min-h-0 flex-1 flex-col py-4">
            {focusView === "list" && (
              <FocusSessionList
                sessions={sessions}
                totalMinutes={Math.round(
                  sessionMinutes({ ...life, timeBlocks: periodBlocks }),
                )}
                onCreate={() => setFocusView("create")}
                onEdit={(session) => setFocusView({ edit: session })}
              />
            )}
            {focusView === "create" && (
              <LifeUi.FocusStartForm
                onCancel={() => setFocusView("list")}
                onStart={startTimer}
                defaultMode={timerMode}
                defaultPomodoro={pomodoroConfig}
                tagOptions={life.tags.map((tag) => tag.name)}
              />
            )}
            {typeof focusView === "object" && (
              <LifeUi.FocusEditView
                session={focusView.edit}
                tagOptions={life.tags.map((tag) => tag.name)}
                tagName={
                  focusView.edit.tagIds.map(tagNameForId).find(Boolean) ?? ""
                }
                onBack={() => setFocusView("list")}
                onDelete={(sessionId) => {
                  dismissFocusSession(sessionId);
                  setLocalSessions((current) =>
                    current.filter((item) => item.id !== sessionId),
                  );
                  setFocusView("list");
                }}
                onSave={(session, tagName) => {
                  const tagId = tagName ? tagIdForName(tagName) : null;
                  setLocalSessions((current) => {
                    const nextSession = {
                      ...session,
                      tagIds: tagId ? [tagId] : [],
                    };
                    const existingIndex = current.findIndex(
                      (item) => item.id === session.id,
                    );
                    if (existingIndex === -1) return [...current, nextSession];
                    return current.map((item) =>
                      item.id === session.id ? nextSession : item,
                    );
                  });
                  setFocusView("list");
                }}
              />
            )}
          </div>
        </WorkspaceModalFrame>
      </WorkspaceDialog>

      <TagsDialog
        open={activeModal === "tags"}
        onOpenChange={closeDetailModal}
        tags={life.tags}
        selectedTagIds={selectedTagIds}
        setSelectedTagIds={setSelectedTagIds}
        draftTag={draftTag}
        setDraftTag={setDraftTag}
        addTag={addTag}
        tagEdit={tagEdit}
        setTagEdit={setTagEdit}
        saveTagEdit={saveTagEdit}
        onRemoveSelected={removeSelectedTags}
        busy={tagBusy}
        error={tagError}
        onFilter={() => setActiveModal(null)}
      />

      <LifeUi.TimerPanel
        startedAt={timerStartedAt}
        now={clockNow}
        mode={timerMode}
        fullscreen={timerFullscreen}
        pomodoro={pomodoroConfig}
        onModeChange={setTimerMode}
        onStart={() => startTimer()}
        onStop={stopTimer}
        onFullscreenChange={setTimerFullscreen}
      />
    </div>
  );
}
