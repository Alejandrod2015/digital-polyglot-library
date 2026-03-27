export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { VARIANT_OPTIONS_BY_LANGUAGE, normalizeVariant } from "@/lib/languageVariant";
import { normalizeJourneyPlacementLevel } from "@/app/journey/journeyData";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
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
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeTargetLanguages(langs: string[]): string[] {
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
    const canonical = aliases[raw.trim().toLowerCase()];
    if (!canonical || !ALLOWED_LANGUAGES.has(canonical)) continue;
    seen.add(canonical);
  }
  return Array.from(seen);
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
  return normalized && ALLOWED_VARIANTS.has(normalized as never) ? normalized : null;
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

function serializePreferences(metadata: Record<string, unknown>) {
  return {
    targetLanguages: isStringArray(metadata.targetLanguages)
      ? normalizeTargetLanguages(metadata.targetLanguages)
      : [],
    interests: isStringArray(metadata.interests) ? normalizeInterests(metadata.interests) : [],
    preferredLevel: typeof metadata.preferredLevel === "string" ? normalizeLevel(metadata.preferredLevel) : null,
    preferredRegion: typeof metadata.preferredRegion === "string" ? normalizeRegion(metadata.preferredRegion) : null,
    preferredVariant:
      typeof metadata.preferredVariant === "string" ? normalizeVariantPreference(metadata.preferredVariant) : null,
    learningGoal: typeof metadata.learningGoal === "string" ? normalizeLearningGoal(metadata.learningGoal) : null,
    journeyFocus:
      typeof metadata.journeyFocus === "string"
        ? normalizeJourneyFocusPreference(metadata.journeyFocus)
        : getJourneyFocusFromLearningGoal(
            typeof metadata.learningGoal === "string" ? normalizeLearningGoal(metadata.learningGoal) : null
          ),
    dailyMinutes: typeof metadata.dailyMinutes === "number" ? normalizeDailyMinutes(metadata.dailyMinutes) : null,
    remindersEnabled: metadata.remindersEnabled === true,
    reminderHour:
      typeof metadata.reminderHour === "number" && ALLOWED_REMINDER_HOURS.has(metadata.reminderHour)
        ? normalizeReminderHour(metadata.reminderHour)
        : null,
    journeyPlacementLevel:
      typeof metadata.journeyPlacementLevel === "string"
        ? normalizeJourneyPlacementLevel(metadata.journeyPlacementLevel)
        : null,
    onboardingSurveyCompletedAt:
      typeof metadata.onboardingSurveyCompletedAt === "string" ? metadata.onboardingSurveyCompletedAt : null,
    onboardingTourCompletedAt:
      typeof metadata.onboardingTourCompletedAt === "string" ? metadata.onboardingTourCompletedAt : null,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const publicMetadata = (user.publicMetadata as Record<string, unknown>) ?? {};
  return NextResponse.json(serializePreferences(publicMetadata));
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const targetLanguages = Object.prototype.hasOwnProperty.call(payload, "targetLanguages")
    ? isStringArray(payload.targetLanguages)
      ? normalizeTargetLanguages(payload.targetLanguages)
      : null
    : undefined;
  const interests = Object.prototype.hasOwnProperty.call(payload, "interests")
    ? isStringArray(payload.interests)
      ? normalizeInterests(payload.interests)
      : null
    : undefined;
  const preferredLevel = Object.prototype.hasOwnProperty.call(payload, "preferredLevel")
    ? normalizeLevel(payload.preferredLevel)
    : undefined;
  const preferredRegion = Object.prototype.hasOwnProperty.call(payload, "preferredRegion")
    ? normalizeRegion(payload.preferredRegion)
    : undefined;
  const preferredVariant = Object.prototype.hasOwnProperty.call(payload, "preferredVariant")
    ? normalizeVariantPreference(payload.preferredVariant)
    : undefined;
  const learningGoal = Object.prototype.hasOwnProperty.call(payload, "learningGoal")
    ? normalizeLearningGoal(payload.learningGoal)
    : undefined;
  const journeyFocus = Object.prototype.hasOwnProperty.call(payload, "journeyFocus")
    ? normalizeJourneyFocusPreference(payload.journeyFocus)
    : undefined;
  const dailyMinutes = Object.prototype.hasOwnProperty.call(payload, "dailyMinutes")
    ? normalizeDailyMinutes(payload.dailyMinutes)
    : undefined;
  const remindersEnabled = Object.prototype.hasOwnProperty.call(payload, "remindersEnabled")
    ? payload.remindersEnabled === null
      ? false
      : normalizeRemindersEnabled(payload.remindersEnabled)
    : undefined;
  const reminderHour = Object.prototype.hasOwnProperty.call(payload, "reminderHour")
    ? normalizeReminderHour(payload.reminderHour)
    : undefined;
  const journeyPlacementLevel = Object.prototype.hasOwnProperty.call(payload, "journeyPlacementLevel")
    ? normalizeJourneyPlacementLevel(payload.journeyPlacementLevel)
    : undefined;
  const onboardingSurveyCompletedAt = Object.prototype.hasOwnProperty.call(payload, "onboardingSurveyCompletedAt")
    ? typeof payload.onboardingSurveyCompletedAt === "string"
      ? payload.onboardingSurveyCompletedAt
      : payload.onboardingSurveyCompletedAt === null
        ? null
        : undefined
    : undefined;
  const onboardingTourCompletedAt = Object.prototype.hasOwnProperty.call(payload, "onboardingTourCompletedAt")
    ? typeof payload.onboardingTourCompletedAt === "string"
      ? payload.onboardingTourCompletedAt
      : payload.onboardingTourCompletedAt === null
        ? null
        : undefined
    : undefined;

  if (targetLanguages === null || interests === null) {
    return NextResponse.json({ error: "Invalid preferences payload" }, { status: 400 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const existing = (user.publicMetadata as Record<string, unknown>) ?? {};
  const updatedMetadata: Record<string, unknown> = { ...existing };

  if (targetLanguages !== undefined) updatedMetadata.targetLanguages = targetLanguages;
  if (interests !== undefined) updatedMetadata.interests = interests;

  if (preferredLevel !== undefined) {
    if (preferredLevel) updatedMetadata.preferredLevel = preferredLevel;
    else delete updatedMetadata.preferredLevel;
  }

  if (preferredRegion !== undefined) {
    if (preferredRegion) updatedMetadata.preferredRegion = preferredRegion;
    else delete updatedMetadata.preferredRegion;
  }

  if (preferredVariant !== undefined) {
    if (preferredVariant) updatedMetadata.preferredVariant = preferredVariant;
    else delete updatedMetadata.preferredVariant;
  }

  if (learningGoal !== undefined) {
    if (learningGoal) updatedMetadata.learningGoal = learningGoal;
    else delete updatedMetadata.learningGoal;
  }

  if (journeyFocus !== undefined) {
    if (journeyFocus) updatedMetadata.journeyFocus = journeyFocus;
    else delete updatedMetadata.journeyFocus;
  }

  if (dailyMinutes !== undefined) {
    if (dailyMinutes) updatedMetadata.dailyMinutes = dailyMinutes;
    else delete updatedMetadata.dailyMinutes;
  }

  if (remindersEnabled !== undefined) {
    if (remindersEnabled) updatedMetadata.remindersEnabled = true;
    else delete updatedMetadata.remindersEnabled;
  }

  if (reminderHour !== undefined) {
    if (reminderHour) updatedMetadata.reminderHour = reminderHour;
    else delete updatedMetadata.reminderHour;
  }

  if (journeyPlacementLevel !== undefined) {
    if (journeyPlacementLevel) updatedMetadata.journeyPlacementLevel = journeyPlacementLevel;
    else delete updatedMetadata.journeyPlacementLevel;
  }

  if (onboardingSurveyCompletedAt !== undefined) {
    if (onboardingSurveyCompletedAt) updatedMetadata.onboardingSurveyCompletedAt = onboardingSurveyCompletedAt;
    else delete updatedMetadata.onboardingSurveyCompletedAt;
  }

  if (onboardingTourCompletedAt !== undefined) {
    if (onboardingTourCompletedAt) updatedMetadata.onboardingTourCompletedAt = onboardingTourCompletedAt;
    else delete updatedMetadata.onboardingTourCompletedAt;
  }

  await clerkClient.users.updateUserMetadata(session.sub, {
    publicMetadata: updatedMetadata,
  });

  const after = await clerkClient.users.getUser(session.sub);
  const publicMetadata = (after.publicMetadata as Record<string, unknown>) ?? {};
  return NextResponse.json(serializePreferences(publicMetadata));
}
