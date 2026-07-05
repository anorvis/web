export type PlatformCalendarEvent = {
  id: string;
  summary: string;
  startAt: string;
  endAt: string;
  tag?: string;
  source?: string;
  readOnly?: boolean;
};

export type TaskPlan = {
  tasks: Array<{
    id: string;
    title: string;
    status: "open" | "done" | string;
    date?: string | null;
    priority?: "urgent" | "high" | "normal" | "low";
    notes?: string;
    links?: string[];
    durationMinutes?: number;
    multiSession?: boolean;
  }>;
  sessions: Array<{
    taskId: string;
    completed?: boolean;
    start?: string | null;
    end?: string | null;
    conflictState?: "none" | "overflow" | "blocked" | null;
  }>;
  prepPackages: Array<{
    taskId: string;
    status?: string | null;
    summary?: string | null;
    suggestedSteps?: string[];
    risksOrQuestions?: string[];
  }>;
};
