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
    maintainerStatus: () => ["dev", "maintainer", "status"] as const,
    maintainerTickets: (group: string, page: number) =>
      ["dev", "maintainer", "tickets", group, page] as const,
    maintainerTicketsRoot: () => ["dev", "maintainer", "tickets"] as const,
    maintainerLinear: () => ["dev", "maintainer", "linear"] as const,
    maintainerLinearTeams: () =>
      ["dev", "maintainer", "linear", "teams"] as const,
    agentUsage: (scope: "foreground" | "maintainer", page: number) =>
      ["dev", "agent-usage", scope, page] as const,
    agentUsageRoot: () => ["dev", "agent-usage"] as const,
  },
  spotify: {
    nowPlaying: () => ["spotify", "now-playing"] as const,
  },
};
