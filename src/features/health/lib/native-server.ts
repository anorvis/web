import "server-only";

import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

function dayBounds(): { todayStart: string; todayEnd: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { todayStart: start.toISOString(), todayEnd: end.toISOString() };
}

export async function getNativeHealthDashboard(): Promise<NativeHealthDashboard> {
  const { todayStart, todayEnd } = dayBounds();
  const params = new URLSearchParams({ todayStart, todayEnd });
  try {
    return await gatewayFetchJson<NativeHealthDashboard>(
      `/v1/health/dashboard?${params.toString()}`,
    );
  } catch {
    return {
      macroProfile: null,
      todayMeals: [],
      recentMeals: [],
      recentWorkouts: [],
      latestCheckin: null,
    };
  }
}
