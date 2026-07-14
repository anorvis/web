import { makeFunctionReference } from "convex/server";

const query = (name: string) =>
  makeFunctionReference<"query", Record<string, unknown>, never>(name);
const mutation = (name: string) =>
  makeFunctionReference<"mutation", Record<string, unknown>, never>(name);
const action = (name: string) =>
  makeFunctionReference<"action", Record<string, unknown>, never>(name);

export const convexApi = {
  workspaces: { ensureDefault: mutation("workspaces:ensureDefault") },
  life: {
    snapshot: query("life:snapshot"),
    listTags: query("life:listTags"),
    upsertTag: mutation("life:upsertTag"),
    updateTag: mutation("life:updateTag"),
  },
  tasks: {
    list: query("tasks:list"),
    create: mutation("tasks:create"),
    update: mutation("tasks:update"),
    complete: mutation("tasks:complete"),
    remove: mutation("tasks:remove"),
    saveSession: mutation("tasks:saveSession"),
    moveSession: mutation("tasks:moveSession"),
  },
  calendar: {
    list: query("calendar:list"),
    create: mutation("calendar:create"),
    update: mutation("calendar:update"),
    remove: mutation("calendar:remove"),
  },
  health: {
    dashboard: query("health:dashboard"),
    measurementHistory: query("health:measurementHistory"),
    getWorkout: query("health:getWorkout"),
    listWorkoutTemplates: query("health:listWorkoutTemplates"),
    saveMeal: mutation("health:saveMeal"),
    removeMeal: mutation("health:removeMeal"),
    saveWorkout: mutation("health:saveWorkout"),
    removeWorkout: mutation("health:removeWorkout"),
    saveBodyMeasurement: mutation("health:saveMeasurement"),
    saveMacroProfile: mutation("health:saveMacroProfile"),
    saveWorkoutTemplate: mutation("health:saveWorkoutTemplate"),
  },
  healthSearch: {
    searchFood: action("healthSearch:searchFood"),
    searchRecipes: action("healthSearch:searchRecipes"),
    importRecipe: action("healthSearch:importRecipe"),
  },
  recipes: {
    list: query("recipes:list"),
    get: query("recipes:get"),
    save: mutation("recipes:save"),
    remove: mutation("recipes:remove"),
    setFavorite: mutation("recipes:setFavorite"),
  },
  finance: {
    dashboard: query("finance:dashboard"),
    saveAccount: mutation("finance:saveAccount"),
    removeAccount: mutation("finance:removeAccount"),
    linkAccount: mutation("finance:linkAccount"),
    unlinkAccount: mutation("finance:unlinkAccount"),
    listTransactions: query("finance:listTransactions"),
  },
  financeDashboard: {
    dashboard: action("financeDashboard:dashboard"),
  },
  financeImport: {
    importCsv: action("financeImport:importCsv"),
    undoImport: mutation("financeImport:undoImport"),
  },
  integrations: {
    list: query("integrations:list"),
    disconnect: mutation("integrations:disconnect"),
    startSync: mutation("integrations:startSync"),
  },
  google: {
    settings: action("google:settings"),
    saveSettings: action("google:saveSettings"),
    start: action("google:start"),
  },
  pinterest: {
    settings: action("pinterest:settings"),
    saveSettings: action("pinterest:saveSettings"),
    start: action("pinterest:start"),
    boardImages: action("pinterest:boardImages"),
  },
  hevy: {
    settings: action("hevy:settings"),
    saveSettings: action("hevy:saveSettings"),
    syncNow: action("hevy:syncNow"),
    listRoutines: action("hevy:listRoutines"),
    saveRoutine: action("hevy:saveRoutine"),
    listExerciseTemplates: action("hevy:listExerciseTemplates"),
  },
  snaptrade: {
    settings: action("snaptrade:settings"),
    saveSettings: action("snaptrade:saveSettings"),
    createConnectionPortal: action("snaptrade:createConnectionPortal"),
    syncNow: action("snaptrade:syncNow"),
  },
  wiki: {
    list: query("wiki:list"),
    get: query("wiki:get"),
    search: query("wiki:search"),
    history: query("wiki:history"),
    backlinks: query("wiki:backlinks"),
    unresolvedLinks: query("wiki:unresolvedLinks"),
    save: mutation("wiki:save"),
    rename: mutation("wiki:rename"),
    setStatus: mutation("wiki:setStatus"),
    rollback: mutation("wiki:rollback"),
    generateUploadUrl: mutation("wiki:generateUploadUrl"),
    listSources: query("wiki:listSources"),
    listAttachments: query("wiki:listAttachments"),
  },
  wikiFiles: {
    registerSource: action("wikiFiles:registerSource"),
    registerAttachment: action("wikiFiles:registerAttachment"),
    searchChunks: action("wikiFiles:searchChunks"),
  },
} as const;
