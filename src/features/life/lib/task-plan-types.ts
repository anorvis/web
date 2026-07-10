export type PlatformCalendarEvent = {
  id: string;
  summary: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  tag?: string;
  source?: string;
  readOnly?: boolean;
  allDay?: boolean;
};

export type TaskPlan = {
  tasks: Array<{
    id: string;
    title: string;
    notes: string | null;
    status: "open" | "completed" | "archived";
    priority: "urgent" | "high" | "normal" | "low" | null;
    dueAt: string | null;
    source: string;
    sourceId: string | null;
    durationMinutes: number | null;
    links: string[];
    multiSession: boolean;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  sessions: Array<{
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    status: "planned" | "completed" | "cancelled";
    source: string;
    createdAt: string;
    updatedAt: string;
  }>;
  prepPackages: Array<{
    taskId: string;
    status?: string | null;
    summary?: string | null;
    suggestedSteps?: string[];
    risksOrQuestions?: string[];
  }>;
};
