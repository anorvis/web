import "server-only";

import type {
  HealthScore,
  HealthSnapshot,
} from "@/features/health/types/health";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import { isHealthSnapshot } from "@/lib/workspace-type-guards";

const emptyScore: HealthScore = {
  overall: null,
  trainingScore: null,
  factors: [],
  nudge:
    "local-only mode: health data should flow through anorvis-os, not a hosted database",
  confidence: "low",
  workoutCount: 0,
};

const localSnapshot: HealthSnapshot = {
  hasHevy: false,
  score: emptyScore,
  recentWorkouts: [],
  trainingDays: [],
  weekWorkoutCount: 0,
  weekTotalVolumeLbs: 0,
  lastSyncedAt: null,
  firstPageWorkouts: [],
  totalWorkouts: 0,
  exerciseList: [],
};

export async function getHealthSnapshot(
  _timezone?: string,
): Promise<HealthSnapshot> {
  return (
    (await readWorkspaceDocument({
      kind: "summary",
      id: "web-health-snapshot",
      isValue: isHealthSnapshot,
    })) ?? localSnapshot
  );
}
