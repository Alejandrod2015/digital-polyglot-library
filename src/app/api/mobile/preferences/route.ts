export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { VARIANT_OPTIONS_BY_LANGUAGE, normalizeVariant } from "@/lib/languageVariant";
import { normalizeJourneyPlacementLevel } from "@/app/journey/journeyData";
import { getActiveMobileSession } from "@/lib/mobileSession";
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
import {
  normalizeReminderHour,
  normalizeReminderMinute,
  normalizeRemindersEnabled,
} from "@/lib/reminders";
import {
  normalizeNotificationPrefs,
  sanitizeNotificationPrefsInput,
} from "@/lib/notifications";
import { normalizeKaraokeEnabled } from "@/lib/readerPreferences";

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

type StoredJourney = {
  id: string;
  language: string;
  variant: string | null;
  region: string | null;
  focus: string;
  level: string | null;
  createdAt: string;
  label: string | null;
};

// Códigos regionales conocidos que el campo `variant` legacy podía
// guardar antes del modelo "un track por Studio Journey". Si el
// `variant` actual matchea uno de estos y `region` no está set, lo
// usamos para backfill; así journeys legacy heredan `region` la
// próxima vez que el server los reescribe (efecto "lazy migration"
// sin necesidad de tocar la DB).
const KNOWN_REGION_CODES = new Set<string>([
  "latam", "spain", "us", "uk", "br", "brazil", "pt", "portugal",
  "germany", "austria", "france", "canada-fr", "italy", "south-korea",
]);

function normalizeJourneysArray(value: unknown, preferredVariant?: string | null): StoredJourney[] | null {
  if (!Array.isArray(value)) return null;
  const out: StoredJourney[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const j = item as Record<string, unknown>;
    const id = typeof j.id === "string" && j.id.trim() ? j.id.trim() : null;
    const language = typeof j.language === "string" && j.language.trim() ? j.language.trim() : null;
    if (!id || !language || seen.has(id)) continue;
    seen.add(id);
    const variant = typeof j.variant === "string" && j.variant.trim() ? j.variant.trim() : null;
    let region = typeof j.region === "string" && j.region.trim() ? j.region.trim() : null;
    // Lazy backfill: journeys creados antes del campo `region` tienen
    // su código regional guardado en `variant` (porque ese era el modelo
    // legacy). Si `variant` parece un código regional conocido (no un
    // cuid de Studio Journey) y `region` está vacío, copiamos.
    if (!region && variant && KNOWN_REGION_CODES.has(variant.toLowerCase())) {
      region = variant.toLowerCase();
    }
    // Segundo backfill (2026-08-20): journeys que salieron del sintetizador
    // legacy ANTES de que `preferredVariant` estuviera guardado se quedaron sin
    // variante y sin región. Un journey sin región se lee en todas partes como
    // "sin preferencia", y entonces el selector enseña TODAS las variantes del
    // idioma. Le pasó a un tester que había pedido España dos veces y acabó
    // dentro de dos historias con jerga mexicana. La preferencia de la cuenta
    // es la respuesta que él dio: se aplica aquí y la fila queda arreglada.
    if (!region && preferredVariant) {
      region = preferredVariant;
    }
    out.push({
      id,
      language,
      variant,
      region,
      focus:
        typeof j.focus === "string" && j.focus.trim()
          ? (normalizeJourneyFocusPreference(j.focus) ?? "General")
          : "General",
      level: typeof j.level === "string" && j.level.trim() ? j.level.trim() : null,
      createdAt: typeof j.createdAt === "string" ? j.createdAt : new Date().toISOString(),
      label: typeof j.label === "string" && j.label.trim() ? j.label.trim() : null,
    });
  }
  return out;
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
      typeof metadata.reminderHour === "number"
        ? normalizeReminderHour(metadata.reminderHour)
        : null,
    reminderMinute:
      typeof metadata.reminderMinute === "number"
        ? normalizeReminderMinute(metadata.reminderMinute)
        : null,
    // Per-type opt-in map. Falls back to per-type defaults, with the
    // legacy global `remindersEnabled` seeding `daily_reminder` for
    // users whose prefs predate this system.
    notificationPrefs: normalizeNotificationPrefs(
      metadata.notificationPrefs,
      metadata.remindersEnabled === true,
    ),
    // Ausente = activado, así que las cuentas que ya existen (todas, hoy)
    // siguen con karaoke sin tocar nada.
    karaokeEnabled: normalizeKaraokeEnabled(metadata.karaokeEnabled),
    journeyPlacementLevel:
      typeof metadata.journeyPlacementLevel === "string"
        ? normalizeJourneyPlacementLevel(metadata.journeyPlacementLevel)
        : null,
    onboardingSurveyCompletedAt:
      typeof metadata.onboardingSurveyCompletedAt === "string" ? metadata.onboardingSurveyCompletedAt : null,
    onboardingTourCompletedAt:
      typeof metadata.onboardingTourCompletedAt === "string" ? metadata.onboardingTourCompletedAt : null,
    journeys:
      normalizeJourneysArray(
        metadata.journeys,
        typeof metadata.preferredVariant === "string"
          ? normalizeVariantPreference(metadata.preferredVariant)
          : null
      ) ?? [],
    activeJourneyId:
      typeof metadata.activeJourneyId === "string" && metadata.activeJourneyId.trim()
        ? metadata.activeJourneyId.trim()
        : null,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const publicMetadata = (user.publicMetadata as Record<string, unknown>) ?? {};
  return NextResponse.json(serializePreferences(publicMetadata));
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const firstName = Object.prototype.hasOwnProperty.call(payload, "firstName")
    ? typeof payload.firstName === "string"
      ? payload.firstName.trim().slice(0, 80)
      : null
    : undefined;
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
  const reminderMinute = Object.prototype.hasOwnProperty.call(payload, "reminderMinute")
    ? normalizeReminderMinute(payload.reminderMinute)
    : undefined;
  const notificationPrefs = Object.prototype.hasOwnProperty.call(payload, "notificationPrefs")
    ? sanitizeNotificationPrefsInput(payload.notificationPrefs)
    : undefined;
  const karaokeEnabled = Object.prototype.hasOwnProperty.call(payload, "karaokeEnabled")
    ? normalizeKaraokeEnabled(payload.karaokeEnabled)
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
  const journeys = Object.prototype.hasOwnProperty.call(payload, "journeys")
    ? normalizeJourneysArray(payload.journeys, preferredVariant ?? null)
    : undefined;
  const activeJourneyId = Object.prototype.hasOwnProperty.call(payload, "activeJourneyId")
    ? typeof payload.activeJourneyId === "string" && payload.activeJourneyId.trim()
      ? payload.activeJourneyId.trim()
      : null
    : undefined;

  if (targetLanguages === null || interests === null) {
    return NextResponse.json({ error: "Invalid preferences payload" }, { status: 400 });
  }
  if (journeys === null) {
    return NextResponse.json({ error: "Invalid journeys payload" }, { status: 400 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const existing = (user.publicMetadata as Record<string, unknown>) ?? {};
  const updatedMetadata: Record<string, unknown> = { ...existing };

  // ── Para BORRAR una preferencia se asigna `null`, nunca `delete` ──
  //
  // `updateUserMetadata` hace MERGE, no reemplazo: omitir una clave no la
  // borra, la conserva. Con `delete` el usuario podía APAGAR lo que se guarda
  // como valor, pero nunca QUITAR nada: la petición salía, respondía bien, y el
  // ajuste volvía como estaba.
  //
  // Medido en un Pixel sobre producción, dos casos y en direcciones opuestas,
  // que es lo que lo confirma: el karaoke no se dejaba ENCENDER (encender
  // borraba la clave) y el recordatorio diario no se dejaba APAGAR (apagar
  // borraba la clave). Siempre falla el lado que borra, nunca el que escribe.
  // Un recordatorio diario que no se puede desactivar son notificaciones que el
  // usuario no puede parar.

  if (targetLanguages !== undefined) updatedMetadata.targetLanguages = targetLanguages;
  if (interests !== undefined) updatedMetadata.interests = interests;

  if (preferredLevel !== undefined) {
    if (preferredLevel) updatedMetadata.preferredLevel = preferredLevel;
    else updatedMetadata.preferredLevel = null;
  }

  if (preferredRegion !== undefined) {
    if (preferredRegion) updatedMetadata.preferredRegion = preferredRegion;
    else updatedMetadata.preferredRegion = null;
  }

  if (preferredVariant !== undefined) {
    if (preferredVariant) updatedMetadata.preferredVariant = preferredVariant;
    else updatedMetadata.preferredVariant = null;
  }

  if (learningGoal !== undefined) {
    if (learningGoal) updatedMetadata.learningGoal = learningGoal;
    else updatedMetadata.learningGoal = null;
  }

  if (journeyFocus !== undefined) {
    if (journeyFocus) updatedMetadata.journeyFocus = journeyFocus;
    else updatedMetadata.journeyFocus = null;
  }

  if (dailyMinutes !== undefined) {
    if (dailyMinutes) updatedMetadata.dailyMinutes = dailyMinutes;
    else updatedMetadata.dailyMinutes = null;
  }

  if (remindersEnabled !== undefined) {
    if (remindersEnabled) updatedMetadata.remindersEnabled = true;
    else updatedMetadata.remindersEnabled = null;
  }

  if (reminderHour !== undefined) {
    if (reminderHour) updatedMetadata.reminderHour = reminderHour;
    else updatedMetadata.reminderHour = null;
  }

  if (reminderMinute !== undefined) {
    if (reminderMinute !== null) updatedMetadata.reminderMinute = reminderMinute;
    else updatedMetadata.reminderMinute = null;
  }

  if (notificationPrefs !== undefined && notificationPrefs !== null) {
    const existingPrefs =
      existing.notificationPrefs &&
      typeof existing.notificationPrefs === "object" &&
      !Array.isArray(existing.notificationPrefs)
        ? (existing.notificationPrefs as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...existingPrefs, ...notificationPrefs };
    updatedMetadata.notificationPrefs = merged;
    // Keep the legacy global flag in sync with daily_reminder so the
    // existing reminder scheduler and any old code paths still work.
    if (typeof merged.daily_reminder === "boolean") {
      if (merged.daily_reminder) updatedMetadata.remindersEnabled = true;
      else updatedMetadata.remindersEnabled = null;
    }
  }

  // Se escribe SIEMPRE el booleano, también cuando está encendido.
  //
  // La primera versión borraba la clave al encender, para no ensuciar la
  // metadata de quien nunca tocó el ajuste. Bonito y roto: `updateUserMetadata`
  // hace MERGE, no reemplazo, así que omitir una clave no la borra, la
  // conserva. Resultado medido en el dispositivo: apagar funcionaba (escribe
  // false) y encender no hacía nada (omitía la clave y Clerk mantenía el false),
  // así que el toggle se apagaba y ya no volvía a encenderse nunca.
  if (karaokeEnabled !== undefined) {
    updatedMetadata.karaokeEnabled = karaokeEnabled;
  }

  if (journeyPlacementLevel !== undefined) {
    if (journeyPlacementLevel) updatedMetadata.journeyPlacementLevel = journeyPlacementLevel;
    else updatedMetadata.journeyPlacementLevel = null;
  }

  if (onboardingSurveyCompletedAt !== undefined) {
    if (onboardingSurveyCompletedAt) updatedMetadata.onboardingSurveyCompletedAt = onboardingSurveyCompletedAt;
    // Clerk's updateUserMetadata MERGES; deleting a key leaves the old value
    // in place. To actually clear it, set null explicitly.
    else updatedMetadata.onboardingSurveyCompletedAt = null;
  }

  if (onboardingTourCompletedAt !== undefined) {
    if (onboardingTourCompletedAt) updatedMetadata.onboardingTourCompletedAt = onboardingTourCompletedAt;
    else updatedMetadata.onboardingTourCompletedAt = null;
  }

  if (journeys !== undefined) {
    if (journeys.length > 0) updatedMetadata.journeys = journeys;
    else updatedMetadata.journeys = null;
  }

  if (activeJourneyId !== undefined) {
    if (activeJourneyId) updatedMetadata.activeJourneyId = activeJourneyId;
    else updatedMetadata.activeJourneyId = null;
  }

  await clerkClient.users.updateUserMetadata(session.sub, {
    publicMetadata: updatedMetadata,
  });

  // firstName is a top-level Clerk field (NOT publicMetadata), so it needs a
  // separate updateUser. Only write a non-empty value so skipping the optional
  // onboarding name step never clears an existing name. Populates the metrics
  // "Usuario" column and mobile greetings.
  if (firstName) {
    await clerkClient.users.updateUser(session.sub, { firstName });
  }

  const after = await clerkClient.users.getUser(session.sub);
  const publicMetadata = (after.publicMetadata as Record<string, unknown>) ?? {};
  return NextResponse.json(serializePreferences(publicMetadata));
}
