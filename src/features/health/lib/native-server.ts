import "server-only";

import { fetchHealthDashboard } from "@/features/health/api/health";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";

export async function getNativeHealthDashboard(): Promise<NativeHealthDashboard> {
  try {
    return await fetchHealthDashboard();
  } catch {
    return {
      macroProfile: null,
      todayMeals: [],
      recentMeals: [],
      recentWorkouts: [],
      measurementHistory: [],
    };
  }
}
