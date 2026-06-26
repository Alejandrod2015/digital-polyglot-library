// Notification type system (Fase 1).
//
// A "notification type" is one category the mobile app can schedule
// locally (and, in Fase 2, that Studio can push remotely). The set of
// keys is fixed in code; the *copy* and *active* flag for each type are
// editable from Studio (`NotificationTypeConfig` rows). If a row is
// missing or the DB is unreachable, the app falls back to the defaults
// declared here, so notifications never silently break.
//
// Per-user opt-in lives in Clerk `publicMetadata.notificationPrefs`
// (a `{ [key]: boolean }` map), mirroring the existing reminder prefs.

export const NOTIFICATION_TYPE_KEYS = [
  "daily_reminder",
  "streak_risk",
  "new_content",
  "practice_due",
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPE_KEYS)[number];

export type NotificationChannel = "local" | "remote" | "both";

export type NotificationTypeDefault = {
  key: NotificationTypeKey;
  label: string;
  description: string;
  title: string;
  body: string;
  /** Default delivery hour (0-23) for scheduled local types; null = event-driven. */
  hourDefault: number | null;
  /** Whether the toggle starts ON for a user who never touched it. */
  localEnabledByDefault: boolean;
  channel: NotificationChannel;
  sortOrder: number;
};

// Code-default copy. These are the fallback strings; Studio overrides
// them per-row. Placeholders ({minutes} etc.) are resolved at schedule
// time on the device; daily_reminder still goes through
// `buildDailyReminderCopy` for context-aware text, so its copy here is
// only the static fallback when no context is available.
export const NOTIFICATION_TYPE_DEFAULTS: Record<NotificationTypeKey, NotificationTypeDefault> = {
  daily_reminder: {
    key: "daily_reminder",
    label: "Daily reminder",
    description: "A once-a-day nudge at the time you pick to keep your streak alive.",
    title: "Stay in the language today",
    body: "A quick {minutes}-minute session is enough to stay on track today.",
    hourDefault: 19,
    localEnabledByDefault: true,
    channel: "both",
    sortOrder: 0,
  },
  streak_risk: {
    key: "streak_risk",
    label: "Streak at risk",
    description: "A heads-up in the evening when your streak is about to break.",
    title: "Your streak is about to break",
    body: "Open one story tonight to keep your {streak}-day streak alive.",
    hourDefault: 20,
    localEnabledByDefault: true,
    channel: "both",
    sortOrder: 1,
  },
  new_content: {
    key: "new_content",
    label: "New content",
    description: "When a new story or journey you might like becomes available.",
    title: "Something new to explore",
    body: "A fresh story just landed in your journey. Take a look when you have a minute.",
    hourDefault: null,
    localEnabledByDefault: true,
    channel: "remote",
    sortOrder: 2,
  },
  practice_due: {
    key: "practice_due",
    label: "Practice due",
    description: "When you have saved words or reviews waiting to be cleared.",
    title: "Reviews are waiting",
    body: "Clear your saved review in {minutes} minutes before it starts piling up.",
    hourDefault: 18,
    localEnabledByDefault: true,
    channel: "both",
    sortOrder: 3,
  },
};

export function isNotificationTypeKey(value: unknown): value is NotificationTypeKey {
  return typeof value === "string" && (NOTIFICATION_TYPE_KEYS as readonly string[]).includes(value);
}

/**
 * Resolve the stored per-user opt-in map into a complete record with a
 * boolean for every known type. Unknown keys are dropped; missing keys
 * fall back to the type's `localEnabledByDefault`. Pass `legacyReminders`
 * (the old `remindersEnabled` flag) to seed `daily_reminder` for users
 * whose prefs predate this system.
 */
export function normalizeNotificationPrefs(
  value: unknown,
  legacyReminders?: boolean,
): Record<NotificationTypeKey, boolean> {
  const stored =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out = {} as Record<NotificationTypeKey, boolean>;
  for (const key of NOTIFICATION_TYPE_KEYS) {
    const raw = stored[key];
    if (typeof raw === "boolean") {
      out[key] = raw;
    } else if (key === "daily_reminder" && typeof legacyReminders === "boolean") {
      // Back-compat: a user who only ever set the old global toggle.
      out[key] = legacyReminders;
    } else {
      out[key] = NOTIFICATION_TYPE_DEFAULTS[key].localEnabledByDefault;
    }
  }
  return out;
}

/** Keep only valid type keys with boolean values (for inbound payloads). */
export function sanitizeNotificationPrefsInput(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const key of NOTIFICATION_TYPE_KEYS) {
    if (typeof record[key] === "boolean") out[key] = record[key] as boolean;
  }
  return out;
}

export type ResolvedNotificationType = {
  key: NotificationTypeKey;
  label: string;
  description: string;
  title: string;
  body: string;
  hourDefault: number | null;
  localEnabledByDefault: boolean;
  channel: NotificationChannel;
  sortOrder: number;
};

type NotificationTypeRow = {
  key: string;
  label: string | null;
  description: string | null;
  title: string | null;
  body: string | null;
  hourDefault: number | null;
  localEnabledByDefault: boolean;
  channel: string | null;
  active: boolean;
  sortOrder: number;
};

/**
 * Merge Studio-edited rows over the code defaults. Inactive rows are
 * dropped. Types with no row keep their code defaults so the app always
 * sees the full, ordered set of active types.
 */
export function resolveNotificationTypes(
  rows: NotificationTypeRow[],
): ResolvedNotificationType[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const resolved: ResolvedNotificationType[] = [];
  for (const key of NOTIFICATION_TYPE_KEYS) {
    const def = NOTIFICATION_TYPE_DEFAULTS[key];
    const row = byKey.get(key);
    if (row && row.active === false) continue;
    const channel = ((row?.channel as NotificationChannel) || def.channel) as NotificationChannel;
    resolved.push({
      key,
      label: row?.label?.trim() || def.label,
      description: row?.description?.trim() || def.description,
      title: row?.title?.trim() || def.title,
      body: row?.body?.trim() || def.body,
      hourDefault: row && row.hourDefault != null ? row.hourDefault : def.hourDefault,
      localEnabledByDefault: row ? row.localEnabledByDefault : def.localEnabledByDefault,
      channel,
      sortOrder: row?.sortOrder ?? def.sortOrder,
    });
  }
  return resolved.sort((a, b) => a.sortOrder - b.sortOrder);
}
