export const queryKeys = {
  overview: () => ["overview"] as const,
  integrations: () => ["integrations"] as const,
  agents: () => ["agents"] as const,
  life: {
    snapshot: () => ["life", "snapshot"] as const,
    tasks: () => ["life", "tasks"] as const,
    calendar: (view: string, key: string) =>
      ["life", "calendar", view, key] as const,
    calendarRoot: () => ["life", "calendar"] as const,
    pinterestBoardImages: () => ["life", "pinterest", "board-images"] as const,
    tags: () => ["life", "tags"] as const,
  },
  health: {
    dashboard: () => ["health", "dashboard"] as const,
    recipes: () => ["health", "recipes"] as const,
    workouts: (page: number) => ["health", "workouts", page] as const,
    workout: (id: string) => ["health", "workout", id] as const,
    workoutsRoot: () => ["health", "workouts"] as const,
    workoutRoot: () => ["health", "workout"] as const,
    sources: () => ["health", "sources"] as const,
    hevyRoutines: () => ["health", "hevy-routines"] as const,
    hevyExerciseTemplates: () => ["health", "hevy-exercise-templates"] as const,
    exerciseStats: (exercise: string) =>
      ["health", "exercise-stats", exercise] as const,
    recipeSearch: (query: string) =>
      ["health", "recipe-search", query] as const,
    foodSearch: (provider: string, query: string) =>
      ["health", "food-search", provider, query] as const,
  },
  finance: {
    snapshot: (currency?: string) =>
      currency
        ? (["finance", "snapshot", currency] as const)
        : (["finance", "snapshot"] as const),
    snaptradeSettings: () => ["finance", "snaptrade", "settings"] as const,
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
    maintenance: () => ["dev", "maintenance"] as const,
  },
  spotify: {
    nowPlaying: () => ["spotify", "now-playing"] as const,
  },
};
