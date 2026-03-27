import type { OnboardingGoal } from "@/lib/onboarding";

export const REMINDER_HOUR_OPTIONS = [8, 12, 18, 20] as const;

export type ReminderHour = (typeof REMINDER_HOUR_OPTIONS)[number];

export type SharedReminderState = {
  remindersEnabled: boolean;
  reminderHour: ReminderHour | null;
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

export function formatReminderHour(hour: number | null | undefined): string {
  if (typeof hour !== "number" || !Number.isFinite(hour)) return "Not set";
  const normalized = ((Math.trunc(hour) % 24) + 24) % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${displayHour}:00 ${suffix}`;
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
        body: `A quick ${preferredMinutes}-minute session is enough to keep your daily loop alive.`,
        target: { kind: "journey" },
      };
  }
}
