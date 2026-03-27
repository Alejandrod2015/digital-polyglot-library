// /src/app/api/user/preferences/route.ts
import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { NextResponse } from "next/server";
import { VARIANT_OPTIONS_BY_LANGUAGE, normalizeVariant } from "@/lib/languageVariant";
import { normalizeJourneyPlacementLevel } from "@/app/journey/journeyData";
import {
  ONBOARDING_DAILY_MINUTES_OPTIONS,
  ONBOARDING_GOAL_OPTIONS,
  JOURNEY_FOCUS_OPTIONS,
  type OnboardingDailyMinutes,
  type OnboardingGoal,
  type JourneyFocus,
  getJourneyFocusFromLearningGoal,
  normalizeJourneyFocus,
} from "@/lib/onboarding";
import { REMINDER_HOUR_OPTIONS, normalizeReminderHour, normalizeRemindersEnabled } from "@/lib/reminders";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const ALLOWED_LANGUAGES = new Set([
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese",
]);
const MAX_INTERESTS = 12;
const ALLOWED_REGIONS = new Set([
  "Colombia",
  "Mexico",
  "Argentina",
  "Peru",
  "Germany",
  "France",
  "Brazil",
  "Portugal",
  "Italy",
  "Spain",
]);
const ALLOWED_VARIANTS = new Set(
  Object.values(VARIANT_OPTIONS_BY_LANGUAGE).flatMap((options) => options.map((option) => option.value))
);
const ALLOWED_GOALS = new Set<string>(ONBOARDING_GOAL_OPTIONS);
const ALLOWED_JOURNEY_FOCUSES = new Set<string>(JOURNEY_FOCUS_OPTIONS);
const ALLOWED_DAILY_MINUTES = new Set<number>(ONBOARDING_DAILY_MINUTES_OPTIONS);
const ALLOWED_REMINDER_HOURS = new Set<number>(REMINDER_HOUR_OPTIONS);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function normalizeInterests(interests: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of interests) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

function normalize(langs: string[]): string[] {
  const aliases: Record<string, string> = {
    english: "English",
    spanish: "Spanish",
    french: "French",
    german: "German",
    italian: "Italian",
    portuguese: "Portuguese",
    japanese: "Japanese",
    korean: "Korean",
    chinese: "Chinese",
  };

  const seen = new Set<string>();
  for (const raw of langs) {
    const key = raw.trim().toLowerCase();
    const canonical = aliases[key];
    if (!canonical) continue;
    if (!ALLOWED_LANGUAGES.has(canonical)) continue;
    seen.add(canonical);
  }
  return Array.from(seen);
}

function normalizeLevel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  if (key === "beginner") return "Beginner";
  if (key === "intermediate") return "Intermediate";
  if (key === "advanced") return "Advanced";
  return null;
}

function normalizeRegion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, string> = {
    colombia: "Colombia",
    mexico: "Mexico",
    argentina: "Argentina",
    peru: "Peru",
    germany: "Germany",
    france: "France",
    brazil: "Brazil",
    brasil: "Brazil",
    portugal: "Portugal",
    italy: "Italy",
    spain: "Spain",
  };
  const normalized = aliases[value.trim().toLowerCase()];
  return normalized && ALLOWED_REGIONS.has(normalized) ? normalized : null;
}

function normalizeVariantPreference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeVariant(value);
  return normalized && ALLOWED_VARIANTS.has(normalized as (typeof VARIANT_OPTIONS_BY_LANGUAGE)[keyof typeof VARIANT_OPTIONS_BY_LANGUAGE][number]["value"])
    ? normalized
    : null;
}

function normalizeLearningGoal(value: unknown): OnboardingGoal | null {
  if (typeof value !== "string") return null;
  const match = ONBOARDING_GOAL_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  return match && ALLOWED_GOALS.has(match) ? match : null;
}

function normalizeJourneyFocusPreference(value: unknown): JourneyFocus | null {
  const match = normalizeJourneyFocus(value);
  return match && ALLOWED_JOURNEY_FOCUSES.has(match) ? match : null;
}

function normalizeDailyMinutes(value: unknown): OnboardingDailyMinutes | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return ALLOWED_DAILY_MINUTES.has(value) ? (value as OnboardingDailyMinutes) : null;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const hasTargetLanguages = Object.prototype.hasOwnProperty.call(body ?? {}, "targetLanguages");
    const hasInterests = Object.prototype.hasOwnProperty.call(body ?? {}, "interests");
    const hasPreferredLevel = Object.prototype.hasOwnProperty.call(body ?? {}, "preferredLevel");
    const hasPreferredRegion = Object.prototype.hasOwnProperty.call(body ?? {}, "preferredRegion");
    const hasPreferredVariant = Object.prototype.hasOwnProperty.call(body ?? {}, "preferredVariant");
    const hasLearningGoal = Object.prototype.hasOwnProperty.call(body ?? {}, "learningGoal");
    const hasJourneyFocus = Object.prototype.hasOwnProperty.call(body ?? {}, "journeyFocus");
    const hasDailyMinutes = Object.prototype.hasOwnProperty.call(body ?? {}, "dailyMinutes");
    const hasRemindersEnabled = Object.prototype.hasOwnProperty.call(body ?? {}, "remindersEnabled");
    const hasReminderHour = Object.prototype.hasOwnProperty.call(body ?? {}, "reminderHour");
    const hasJourneyPlacementLevel = Object.prototype.hasOwnProperty.call(body ?? {}, "journeyPlacementLevel");
    const hasOnboardingSurveyCompletedAt = Object.prototype.hasOwnProperty.call(body ?? {}, "onboardingSurveyCompletedAt");
    const hasOnboardingTourCompletedAt = Object.prototype.hasOwnProperty.call(body ?? {}, "onboardingTourCompletedAt");
    const targetLanguages = body?.targetLanguages;
    const interests = body?.interests;
    const preferredLevel = body?.preferredLevel;
    const preferredRegion = body?.preferredRegion;
    const preferredVariant = body?.preferredVariant;
    const learningGoal = body?.learningGoal;
    const journeyFocus = body?.journeyFocus;
    const dailyMinutes = body?.dailyMinutes;
    const remindersEnabled = body?.remindersEnabled;
    const reminderHour = body?.reminderHour;
    const journeyPlacementLevel = body?.journeyPlacementLevel;
    const onboardingSurveyCompletedAt = body?.onboardingSurveyCompletedAt;
    const onboardingTourCompletedAt = body?.onboardingTourCompletedAt;

    if (hasTargetLanguages && !isStringArray(targetLanguages)) {
      return NextResponse.json(
        { error: "Invalid targetLanguages: expected string[]" },
        { status: 400 }
      );
    }
    if (hasInterests && !isStringArray(interests)) {
      return NextResponse.json(
        { error: "Invalid interests: expected string[]" },
        { status: 400 }
      );
    }
    if (hasPreferredLevel && preferredLevel !== null && typeof preferredLevel !== "string") {
      return NextResponse.json({ error: "Invalid preferredLevel: expected string|null" }, { status: 400 });
    }
    if (hasPreferredRegion && preferredRegion !== null && typeof preferredRegion !== "string") {
      return NextResponse.json({ error: "Invalid preferredRegion: expected string|null" }, { status: 400 });
    }
    if (hasPreferredVariant && preferredVariant !== null && typeof preferredVariant !== "string") {
      return NextResponse.json({ error: "Invalid preferredVariant: expected string|null" }, { status: 400 });
    }
    if (hasLearningGoal && learningGoal !== null && typeof learningGoal !== "string") {
      return NextResponse.json({ error: "Invalid learningGoal: expected string|null" }, { status: 400 });
    }
    if (hasJourneyFocus && journeyFocus !== null && typeof journeyFocus !== "string") {
      return NextResponse.json({ error: "Invalid journeyFocus: expected string|null" }, { status: 400 });
    }
    if (hasDailyMinutes && dailyMinutes !== null && typeof dailyMinutes !== "number") {
      return NextResponse.json({ error: "Invalid dailyMinutes: expected number|null" }, { status: 400 });
    }
    if (hasRemindersEnabled && remindersEnabled !== null && typeof remindersEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid remindersEnabled: expected boolean|null" }, { status: 400 });
    }
    if (hasReminderHour && reminderHour !== null && typeof reminderHour !== "number") {
      return NextResponse.json({ error: "Invalid reminderHour: expected number|null" }, { status: 400 });
    }
    if (hasJourneyPlacementLevel && journeyPlacementLevel !== null && typeof journeyPlacementLevel !== "string") {
      return NextResponse.json({ error: "Invalid journeyPlacementLevel: expected string|null" }, { status: 400 });
    }
    if (hasOnboardingSurveyCompletedAt && onboardingSurveyCompletedAt !== null && typeof onboardingSurveyCompletedAt !== "string") {
      return NextResponse.json({ error: "Invalid onboardingSurveyCompletedAt: expected string|null" }, { status: 400 });
    }
    if (hasOnboardingTourCompletedAt && onboardingTourCompletedAt !== null && typeof onboardingTourCompletedAt !== "string") {
      return NextResponse.json({ error: "Invalid onboardingTourCompletedAt: expected string|null" }, { status: 400 });
    }

    // 1) Leer metadatos actuales
    const user = await clerkClient.users.getUser(userId);
    const existing =
      (user.publicMetadata as Record<string, unknown>) ?? {};
    const existingTargetLanguages = isStringArray(existing.targetLanguages)
      ? normalize(existing.targetLanguages)
      : [];
    const existingInterests = isStringArray(existing.interests)
      ? normalizeInterests(existing.interests)
      : [];

    const normalizedTargetLanguages = hasTargetLanguages
      ? normalize(targetLanguages)
      : existingTargetLanguages;
    const normalizedInterests = hasInterests
      ? normalizeInterests(interests)
      : existingInterests;
    const normalizedPreferredLevel = hasPreferredLevel
      ? normalizeLevel(preferredLevel)
      : typeof existing.preferredLevel === "string"
        ? normalizeLevel(existing.preferredLevel)
        : null;
    const normalizedPreferredRegion = hasPreferredRegion
      ? normalizeRegion(preferredRegion)
      : typeof existing.preferredRegion === "string"
        ? normalizeRegion(existing.preferredRegion)
        : null;
    const normalizedPreferredVariant = hasPreferredVariant
      ? normalizeVariantPreference(preferredVariant)
      : typeof existing.preferredVariant === "string"
        ? normalizeVariantPreference(existing.preferredVariant)
        : null;
    const normalizedLearningGoal = hasLearningGoal
      ? normalizeLearningGoal(learningGoal)
      : typeof existing.learningGoal === "string"
        ? normalizeLearningGoal(existing.learningGoal)
        : null;
    const normalizedJourneyFocus = hasJourneyFocus
      ? normalizeJourneyFocusPreference(journeyFocus)
      : typeof existing.journeyFocus === "string"
        ? normalizeJourneyFocusPreference(existing.journeyFocus)
        : getJourneyFocusFromLearningGoal(normalizedLearningGoal);
    const normalizedDailyMinutes = hasDailyMinutes
      ? normalizeDailyMinutes(dailyMinutes)
      : typeof existing.dailyMinutes === "number"
        ? normalizeDailyMinutes(existing.dailyMinutes)
        : null;
    const normalizedRemindersEnabled = hasRemindersEnabled
      ? normalizeRemindersEnabled(remindersEnabled)
      : existing.remindersEnabled === true;
    const normalizedReminderHour = hasReminderHour
      ? normalizeReminderHour(reminderHour)
      : typeof existing.reminderHour === "number" && ALLOWED_REMINDER_HOURS.has(existing.reminderHour)
        ? normalizeReminderHour(existing.reminderHour)
        : null;
    const normalizedJourneyPlacementLevel = hasJourneyPlacementLevel
      ? normalizeJourneyPlacementLevel(journeyPlacementLevel)
      : typeof existing.journeyPlacementLevel === "string"
        ? normalizeJourneyPlacementLevel(existing.journeyPlacementLevel)
        : null;
    const normalizedOnboardingSurveyCompletedAt = hasOnboardingSurveyCompletedAt
      ? typeof onboardingSurveyCompletedAt === "string"
        ? onboardingSurveyCompletedAt
        : null
      : typeof existing.onboardingSurveyCompletedAt === "string"
        ? existing.onboardingSurveyCompletedAt
        : null;
    const normalizedOnboardingTourCompletedAt = hasOnboardingTourCompletedAt
      ? typeof onboardingTourCompletedAt === "string"
        ? onboardingTourCompletedAt
        : null
      : typeof existing.onboardingTourCompletedAt === "string"
        ? existing.onboardingTourCompletedAt
        : null;

    const updatedMetadata: Record<string, unknown> = {
      ...existing,
      targetLanguages: normalizedTargetLanguages,
      interests: normalizedInterests,
    };

    if (normalizedPreferredLevel) {
      updatedMetadata.preferredLevel = normalizedPreferredLevel;
    } else {
      delete updatedMetadata.preferredLevel;
    }

    if (normalizedPreferredRegion) {
      updatedMetadata.preferredRegion = normalizedPreferredRegion;
    } else {
      delete updatedMetadata.preferredRegion;
    }

    if (normalizedPreferredVariant) {
      updatedMetadata.preferredVariant = normalizedPreferredVariant;
    } else {
      delete updatedMetadata.preferredVariant;
    }

    if (normalizedLearningGoal) {
      updatedMetadata.learningGoal = normalizedLearningGoal;
    } else {
      delete updatedMetadata.learningGoal;
    }

    if (normalizedJourneyFocus) {
      updatedMetadata.journeyFocus = normalizedJourneyFocus;
    } else {
      delete updatedMetadata.journeyFocus;
    }

    if (normalizedDailyMinutes) {
      updatedMetadata.dailyMinutes = normalizedDailyMinutes;
    } else {
      delete updatedMetadata.dailyMinutes;
    }

    if (normalizedRemindersEnabled) {
      updatedMetadata.remindersEnabled = true;
    } else {
      delete updatedMetadata.remindersEnabled;
    }

    if (normalizedReminderHour) {
      updatedMetadata.reminderHour = normalizedReminderHour;
    } else {
      delete updatedMetadata.reminderHour;
    }

    if (normalizedJourneyPlacementLevel) {
      updatedMetadata.journeyPlacementLevel = normalizedJourneyPlacementLevel;
    } else {
      delete updatedMetadata.journeyPlacementLevel;
    }

    if (normalizedOnboardingSurveyCompletedAt) {
      updatedMetadata.onboardingSurveyCompletedAt = normalizedOnboardingSurveyCompletedAt;
    } else {
      delete updatedMetadata.onboardingSurveyCompletedAt;
    }

    if (normalizedOnboardingTourCompletedAt) {
      updatedMetadata.onboardingTourCompletedAt = normalizedOnboardingTourCompletedAt;
    } else {
      delete updatedMetadata.onboardingTourCompletedAt;
    }

    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: updatedMetadata,
    });

    // 3) Confirmar estado final desde Clerk (lectura posterior al update)
    const after = await clerkClient.users.getUser(userId);
    const finalMeta =
      (after.publicMetadata as Record<string, unknown>) ?? {};
    const finalTL = Array.isArray(finalMeta.targetLanguages)
      ? finalMeta.targetLanguages.filter((x): x is string => typeof x === "string")
      : [];
    const finalInterests = Array.isArray(finalMeta.interests)
      ? finalMeta.interests.filter((x): x is string => typeof x === "string")
      : [];
    const finalPreferredLevel =
      typeof finalMeta.preferredLevel === "string" ? finalMeta.preferredLevel : null;
    const finalPreferredRegion =
      typeof finalMeta.preferredRegion === "string" ? finalMeta.preferredRegion : null;
    const finalPreferredVariant =
      typeof finalMeta.preferredVariant === "string" ? finalMeta.preferredVariant : null;
    const finalLearningGoal =
      typeof finalMeta.learningGoal === "string" ? finalMeta.learningGoal : null;
    const finalJourneyFocus =
      typeof finalMeta.journeyFocus === "string"
        ? normalizeJourneyFocusPreference(finalMeta.journeyFocus)
        : getJourneyFocusFromLearningGoal(finalLearningGoal as OnboardingGoal | null);
    const finalDailyMinutes =
      typeof finalMeta.dailyMinutes === "number" ? finalMeta.dailyMinutes : null;
    const finalRemindersEnabled = finalMeta.remindersEnabled === true;
    const finalReminderHour =
      typeof finalMeta.reminderHour === "number" ? normalizeReminderHour(finalMeta.reminderHour) : null;
    const finalJourneyPlacementLevel =
      typeof finalMeta.journeyPlacementLevel === "string"
        ? normalizeJourneyPlacementLevel(finalMeta.journeyPlacementLevel)
        : null;
    const finalOnboardingSurveyCompletedAt =
      typeof finalMeta.onboardingSurveyCompletedAt === "string" ? finalMeta.onboardingSurveyCompletedAt : null;
    const finalOnboardingTourCompletedAt =
      typeof finalMeta.onboardingTourCompletedAt === "string" ? finalMeta.onboardingTourCompletedAt : null;

    return new NextResponse(
      JSON.stringify({
        targetLanguages: finalTL,
        interests: finalInterests,
        preferredLevel: finalPreferredLevel,
        preferredRegion: finalPreferredRegion,
        preferredVariant: finalPreferredVariant,
        learningGoal: finalLearningGoal,
        journeyFocus: finalJourneyFocus,
        dailyMinutes: finalDailyMinutes,
        remindersEnabled: finalRemindersEnabled,
        reminderHour: finalReminderHour,
        journeyPlacementLevel: finalJourneyPlacementLevel,
        onboardingSurveyCompletedAt: finalOnboardingSurveyCompletedAt,
        onboardingTourCompletedAt: finalOnboardingTourCompletedAt,
      }),
      {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      }
    );
  } catch (error: unknown) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
