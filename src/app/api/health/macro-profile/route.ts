import { NextResponse } from "next/server";
import { HealthRequestBodySchema } from "@/features/health/api/schemas";
import { bmrMifflinStJeor, tdee } from "@/features/health/lib/health-metrics";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

function ageFromBirthdate(value: unknown): number {
  if (typeof value !== "string") return 30;
  const birthdate = new Date(value);
  if (Number.isNaN(birthdate.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const hadBirthday =
    now.getMonth() > birthdate.getMonth() ||
    (now.getMonth() === birthdate.getMonth() &&
      now.getDate() >= birthdate.getDate());
  if (!hadBirthday) age -= 1;
  return age > 0 ? age : 30;
}

function calculateTargets(input: Record<string, unknown>) {
  const weightKg = Number(input.weightKg) || 80;
  const heightCm = Number(input.heightCm) || 178;
  const age = ageFromBirthdate(input.birthdate);
  const sex = String(input.sex || "male");
  const activity = String(input.activityLevel || "moderate");
  const goal = String(input.goal || "maintain");
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex });
  const targetCalories = Math.round(
    tdee(bmr, activity) + (goal === "gain" ? 250 : goal === "lose" ? -350 : 0),
  );
  const proteinGrams = Math.round(weightKg * (goal === "gain" ? 2 : 1.8));
  const fatGrams = Math.round(
    Math.max(weightKg * 0.6, (targetCalories * 0.22) / 9),
  );
  const carbsGrams = Math.max(
    0,
    Math.round((targetCalories - proteinGrams * 4 - fatGrams * 9) / 4),
  );
  return { targetCalories, proteinGrams, carbsGrams, fatGrams };
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export async function POST(request: Request) {
  const decoded = decodeUnknownResult(
    HealthRequestBodySchema,
    await request.json().catch(() => null),
  );
  const body = decoded.ok ? decoded.value : {};
  const calculated = calculateTargets(body);
  const targets = {
    targetCalories:
      positiveNumber(body.targetCalories) ?? calculated.targetCalories,
    proteinGrams: positiveNumber(body.proteinGrams) ?? calculated.proteinGrams,
    carbsGrams: positiveNumber(body.carbsGrams) ?? calculated.carbsGrams,
    fatGrams: positiveNumber(body.fatGrams) ?? calculated.fatGrams,
  };
  const profile = await gatewayFetchJson("/v1/health/macro-profile", {
    method: "POST",
    body: JSON.stringify({
      goal: String(body.goal || "maintain"),
      sex: String(body.sex || "male"),
      age: ageFromBirthdate(body.birthdate),
      heightCm: Number(body.heightCm) || 178,
      weightKg: Number(body.weightKg) || 80,
      bodyFatPercent: body.bodyFatPercent ? Number(body.bodyFatPercent) : null,
      activityLevel: String(body.activityLevel || "moderate"),
      birthdate: typeof body.birthdate === "string" ? body.birthdate : null,
      trainingDaysPerWeek: Number(body.trainingDaysPerWeek) || 3,
      ...targets,
    }),
  });
  return NextResponse.json(profile);
}
