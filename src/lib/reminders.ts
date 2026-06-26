import type { OnboardingGoal } from "@/lib/onboarding";

// 24 chips, una por cada hora del día. Antes era [8, 12, 18, 20]
// (4 slots fijos) pero el usuario quería poder elegir cualquier hora.
// Para granularidad de minuto usamos REMINDER_MINUTE_OPTIONS (cada 15
// minutos); combinadas dan 96 slots posibles "HH:MM".
export const REMINDER_HOUR_OPTIONS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const;

export const REMINDER_MINUTE_OPTIONS = [0, 15, 30, 45] as const;

export type ReminderHour = (typeof REMINDER_HOUR_OPTIONS)[number];
export type ReminderMinute = (typeof REMINDER_MINUTE_OPTIONS)[number];

export type SharedReminderState = {
  remindersEnabled: boolean;
  reminderHour: ReminderHour | null;
  /** Minuto del día (0/15/30/45). Optional para back-compat con
   *  preferences sin minuto guardado; ausente se trata como :00. */
  reminderMinute?: ReminderMinute | null;
};

export type DailyReminderContext = {
  continueStoryTitle?: string | null;
  continueBookTitle?: string | null;
  continueBookSlug?: string | null;
  continueStorySlug?: string | null;
  dueReviewCount?: number | null;
  journeyActionTitle?: string | null;
  journeyActionBody?: string | null;
};

export type ReminderDestination =
  | {
      kind: "resumeStory";
      bookSlug: string;
      storySlug: string;
    }
  | {
      kind: "practiceDue";
    }
  | {
      kind: "journey";
    };

export function normalizeRemindersEnabled(value: unknown): boolean {
  return value === true;
}

export function normalizeReminderHour(value: unknown): ReminderHour | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return REMINDER_HOUR_OPTIONS.find((option) => option === value) ?? null;
}

export function normalizeReminderMinute(value: unknown): ReminderMinute | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return REMINDER_MINUTE_OPTIONS.find((option) => option === value) ?? null;
}

export function formatReminderHour(
  hour: number | null | undefined,
  minute: number | null | undefined = 0
): string {
  if (typeof hour !== "number" || !Number.isFinite(hour)) return "Not set";
  const normalizedHour = ((Math.trunc(hour) % 24) + 24) % 24;
  const min =
    typeof minute === "number" && Number.isFinite(minute)
      ? ((Math.trunc(minute) % 60) + 60) % 60
      : 0;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  const minStr = min.toString().padStart(2, "0");
  return `${displayHour}:${minStr} ${suffix}`;
}

export function buildDailyReminderCopy(args: {
  learningGoal: OnboardingGoal | null;
  dailyMinutes: number | null;
  context?: DailyReminderContext | null;
}): { title: string; body: string; target: ReminderDestination } {
  const context = args.context ?? null;
  const preferredMinutes =
    typeof args.dailyMinutes === "number" && args.dailyMinutes > 0 ? args.dailyMinutes : 5;

  if (
    context?.continueStoryTitle &&
    context.continueBookSlug &&
    context.continueStorySlug
  ) {
    return {
      title: `Resume ${context.continueStoryTitle}`,
      body: context.continueBookTitle
        ? `${context.continueBookTitle} is already in motion. Finish the story, then do a quick ${preferredMinutes}-minute review.`
        : `Your story is already in motion. Finish it, then do a quick ${preferredMinutes}-minute review.`,
      target: {
        kind: "resumeStory",
        bookSlug: context.continueBookSlug,
        storySlug: context.continueStorySlug,
      },
    };
  }

  if (typeof context?.dueReviewCount === "number" && context.dueReviewCount > 0) {
    return {
      title: `${context.dueReviewCount} due ${context.dueReviewCount === 1 ? "word" : "words"} waiting`,
      body: `Clear your saved review in ${preferredMinutes} minutes before it starts piling up.`,
      target: { kind: "practiceDue" },
    };
  }

  if (context?.journeyActionTitle) {
    return {
      title: context.journeyActionTitle,
      body:
        context.journeyActionBody ||
        `Journey already knows your best next step. A ${preferredMinutes}-minute session is enough to keep moving.`,
      target: { kind: "journey" },
    };
  }

  switch (args.learningGoal) {
    case "Travel":
      return {
        title: "Keep your travel language warm",
        body: `Do one authentic story or a ${preferredMinutes}-minute review before the day gets away from you.`,
        target: { kind: "journey" },
      };
    case "Work":
      return {
        title: "Keep your work vocabulary active",
        body: `A short ${preferredMinutes}-minute review today will keep your professional language moving.`,
        target: { kind: "journey" },
      };
    case "Culture":
      return {
        title: "Read something culturally real today",
        body: `Open one story and give yourself ${preferredMinutes} minutes with authentic language.`,
        target: { kind: "journey" },
      };
    case "Fluency":
      return {
        title: "Keep the path moving today",
        body: `One story and one ${preferredMinutes}-minute review is enough to stay in the language.`,
        target: { kind: "journey" },
      };
    case "Daily life":
    default:
      return {
        title: "Stay in the language today",
        body: `A quick ${preferredMinutes}-minute session is enough to stay on track today.`,
        target: { kind: "journey" },
      };
  }
}
