export const queryKeys = {
  overview: () => ["overview"] as const,
  integrations: () => ["integrations"] as const,
  agents: () => ["agents"] as const,
  life: {
    snapshot: () => ["life", "snapshot"] as const,
    tasks: () => ["life", "tasks"] as const,
    calendar: (view: string, key: string) =>
      ["life", "calendar", view, key] as const,
  },
  health: {
    dashboard: () => ["health", "dashboard"] as const,
    workouts: (page: number) => ["health", "workouts", page] as const,
    workout: (id: string) => ["health", "workout", id] as const,
    exerciseStats: (exercise: string) =>
      ["health", "exercise-stats", exercise] as const,
  },
  finance: {
    snapshot: () => ["finance", "snapshot"] as const,
  },
  chat: {
    sessions: (agent: string, search: string) =>
      ["chat", "sessions", agent, search] as const,
    messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
  },
  dev: {
    runs: () => ["dev", "runs"] as const,
    jobs: () => ["dev", "jobs"] as const,
    osEvents: () => ["dev", "os-events"] as const,
    logs: (runId: string) => ["dev", "runs", runId, "logs"] as const,
    output: (runId: string) => ["dev", "runs", runId, "output"] as const,
    piSession: (runId: string) => ["dev", "runs", runId, "pi-session"] as const,
    memories: () => ["dev", "memories"] as const,
    memoryGraph: () => ["dev", "memories", "graph"] as const,
  },
  spotify: {
    nowPlaying: () => ["spotify", "now-playing"] as const,
  },
};
