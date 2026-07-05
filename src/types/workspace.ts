export type DataRecord = {
  data_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type AgentMetrics = {
  status: string;
  version: string;
  uptime_seconds: number;
  model: string;
  requests_total: number;
  requests_success: number;
  requests_error: number;
  error_rate: number;
  avg_latency_ms: number;
  last_latency_ms: number;
  tool_calls: number;
  last_request_at: string | null;
  last_error: string | null;
};

export type ActivityEvent = {
  timestamp: string;
  kind: string;
  message: string;
  level: string;
};

export type SectionDataState<T> = {
  data: T | null;
  error: string | null;
};

export type DomainKey = "life" | "health" | "finance" | "library" | "dev";

export type WeekGridEventKind = "mandatory" | "agent_overlay";

export type WeekGridEvent = {
  id: string;
  day: number;
  startHour: number;
  endHour: number;
  label: string;
  kind: WeekGridEventKind;
};

export type PriorityLabel =
  | "overdue"
  | "due soon"
  | "upcoming"
  | "scheduled"
  | "no date";

export type LifePriorityTask = {
  id: string;
  title: string;
  source: string;
  dueAt: number | null;
  dueContext: string;
  label: PriorityLabel;
  score: number;
  notes?: string | null;
  links?: string[];
  durationMinutes?: number;
  priority?: "low" | "normal" | "high" | "urgent";
  multiSession?: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  conflictState?: "none" | "overflow" | "blocked" | null;
  prepStatus?: string | null;
  prepSummary?: string | null;
  suggestedSteps?: string[];
  risksOrQuestions?: string[];
};

export type TodayEvent = {
  id: string;
  hour: number;
  endHour: number;
  summary: string;
  type: "default" | "focusTime" | "outOfOffice";
};

export type CalendarEvent = {
  id: string;
  summary: string;
  startMinute: number; // 0-1439 (minutes since midnight)
  endMinute: number; // 1-1440
  type:
    | "default"
    | "focusTime"
    | "outOfOffice"
    | "plannedTask"
    | "taskDeadline";
  dayIndex?: number; // 0=Sun..6=Sat, present in week view
  date: string; // YYYY-MM-DD in user's timezone
  allDay?: boolean;
  conflictState?: "none" | "overflow" | "blocked";
  taskId?: string;
  tag?: string | null;
  source?: "local" | "google-calendar" | "task" | string;
  calendarId?: string | null;
  readOnly?: boolean;
};

export type LayoutEvent = CalendarEvent & {
  column: number; // 0-based column in collision group
  totalColumns: number; // total columns in collision group
};

export type HeatmapDay = {
  date: string;
  completedCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type ProviderSetupStatus = "connected" | "available" | "unavailable";

export type LifeSnapshot = {
  hasGoogleCalendar: boolean;
  hasGoogleTasks: boolean;
  hasSpotify: boolean;
  googleCalendarStatus: ProviderSetupStatus;
  googleTasksStatus: ProviderSetupStatus;
  spotifyStatus: ProviderSetupStatus;
  timezoneLabel: string;

  queue: LifePriorityTask[];
  doNow: string;
  doNext: string;

  todayEvents: TodayEvent[];
  currentHour: number;

  executionScore: number | null;
  executionScoreStatusText: string;

  weekEventCounts: number[];
  weekTotalEvents: number;
  todayEventCount: number;

  heatmapData: HeatmapDay[];

  weekGridEvents: WeekGridEvent[];

  todayCalendarEvents: CalendarEvent[];
  weekCalendarEvents: CalendarEvent[];

  currentEvent: { summary: string } | null;
  nextEvent: { summary: string; startsInMinutes: number } | null;
};
