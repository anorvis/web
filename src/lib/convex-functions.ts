import { makeFunctionReference } from "convex/server";

const query = <Return = never>(name: string) =>
  makeFunctionReference<"query", Record<string, unknown>, Return>(name);
const mutation = (name: string) =>
  makeFunctionReference<"mutation", Record<string, unknown>, never>(name);
const action = (name: string) =>
  makeFunctionReference<"action", Record<string, unknown>, never>(name);

export type IntegrationPublication = {
  provider: string;
  status: string;
  sync: {
    sequence: number;
    lastSyncedAt: number | null;
  };
};

export const convexApi = {
  workspaces: {
    ensureDefault: mutation("platform/workspace:ensureDefault"),
    viewer: query<{ role?: string } | null>("platform/workspace:viewer"),
  },
  life: {
    snapshot: query("capability/life:snapshot"),
    listTags: query("capability/life:listTags"),
    upsertTag: mutation("capability/life:upsertTag"),
    updateTag: mutation("capability/life:updateTag"),
  },
  tasks: {
    list: query("capability/task:list"),
    create: mutation("capability/task:create"),
    update: mutation("capability/task:update"),
    complete: mutation("capability/task:complete"),
    remove: mutation("capability/task:remove"),
    saveSession: mutation("capability/task:saveSession"),
    moveSession: mutation("capability/task:moveSession"),
  },
  calendar: {
    list: query("capability/calendar:list"),
    create: mutation("capability/calendar:create"),
    update: mutation("capability/calendar:update"),
    remove: mutation("capability/calendar:remove"),
  },
  health: {
    dashboard: query("capability/health:dashboard"),
    measurementHistory: query("capability/health:measurementHistory"),
    getWorkout: query("capability/health:getWorkout"),
    listWorkoutTemplates: query("capability/health:listWorkoutTemplates"),
    saveMeal: mutation("capability/health:saveMeal"),
    removeMeal: mutation("capability/health:removeMeal"),
    saveWorkout: mutation("capability/health:saveWorkout"),
    removeWorkout: mutation("capability/health:removeWorkout"),
    saveBodyMeasurement: mutation("capability/health:saveMeasurement"),
    saveMacroProfile: mutation("capability/health:saveMacroProfile"),
    saveWorkoutTemplate: mutation("capability/health:saveWorkoutTemplate"),
  },
  healthSearch: {
    searchFood: action("capability/health/search:searchFood"),
    searchRecipes: action("capability/health/search:searchRecipes"),
    importRecipe: action("capability/health/search:importRecipe"),
  },
  recipes: {
    list: query("capability/health/recipes:list"),
    get: query("capability/health/recipes:get"),
    save: mutation("capability/health/recipes:save"),
    remove: mutation("capability/health/recipes:remove"),
    setFavorite: mutation("capability/health/recipes:setFavorite"),
  },
  finance: {
    dashboard: query("capability/finance:dashboard"),
    saveAccount: mutation("capability/finance:saveAccount"),
    removeAccount: mutation("capability/finance:removeAccount"),
    linkAccount: mutation("capability/finance:linkAccount"),
    unlinkAccount: mutation("capability/finance:unlinkAccount"),
    listTransactions: query("capability/finance:listTransactions"),
  },
  financeDashboard: {
    dashboard: action("product/web/finance:dashboard"),
  },
  financeImport: {
    importCsv: action("capability/finance/import:importCsv"),
    undoImport: mutation("capability/finance/import:undoImport"),
  },
  integrations: {
    list: query<IntegrationPublication[]>("capability/integration:list"),
    disconnect: mutation("capability/integration:disconnect"),
    startSync: mutation("capability/integration:startSync"),
    syncJobStatus: query("capability/integration:syncJobStatus"),
  },
  google: {
    settings: action("capability/integration/google:settings"),
    saveSettings: action("capability/integration/google:saveSettings"),
    start: action("capability/integration/google:start"),
    disconnect: action("capability/integration/google:disconnect"),
  },
  pinterest: {
    settings: action("capability/integration/pinterest:settings"),
    saveSettings: action("capability/integration/pinterest:saveSettings"),
    start: action("capability/integration/pinterest:start"),
    boardImages: action("capability/integration/pinterest:boardImages"),
  },
  hevy: {
    settings: action("capability/integration/hevy:settings"),
    saveSettings: action("capability/integration/hevy:saveSettings"),
    syncNow: action("capability/integration/hevy:syncNow"),
    listRoutines: action("capability/integration/hevy:listRoutines"),
    saveRoutine: action("capability/integration/hevy:saveRoutine"),
    listExerciseTemplates: action(
      "capability/integration/hevy:listExerciseTemplates",
    ),
  },
  snaptrade: {
    settings: action("capability/finance/snaptrade:settings"),
    saveSettings: action("capability/finance/snaptrade:saveSettings"),
    createConnectionPortal: action(
      "capability/finance/snaptrade:createConnectionPortal",
    ),
    syncNow: action("capability/finance/snaptrade:syncNow"),
  },
  wiki: {
    list: query("capability/wiki:list"),
    get: query("capability/wiki:get"),
    search: query("capability/wiki:search"),
    history: query("capability/wiki:history"),
    backlinks: query("capability/wiki:backlinks"),
    unresolvedLinks: query("capability/wiki:unresolvedLinks"),
    save: mutation("capability/wiki:save"),
    rename: mutation("capability/wiki:rename"),
    setStatus: mutation("capability/wiki:setStatus"),
    rollback: mutation("capability/wiki:rollback"),
    generateUploadUrl: mutation("capability/wiki:generateUploadUrl"),
    listSources: query("capability/wiki:listSources"),
    listAttachments: query("capability/wiki:listAttachments"),
  },
  wikiFiles: {
    registerSource: action("capability/wiki/files:registerSource"),
    registerAttachment: action("capability/wiki/files:registerAttachment"),
    searchChunks: action("capability/wiki/files:searchChunks"),
  },
} as const;
