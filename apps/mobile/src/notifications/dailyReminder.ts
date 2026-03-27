import {
  buildDailyReminderCopy,
  formatReminderHour,
  type DailyReminderContext,
  type ReminderDestination,
} from "@/lib/reminders";
import type { OnboardingGoal } from "@/lib/onboarding";

export type { ReminderDestination } from "@/lib/reminders";

const DAILY_LOOP_REMINDER_TAG = "daily-loop-reminder";

export type ReminderScheduleState =
  | { status: "disabled"; message: string }
  | { status: "scheduled"; message: string; scheduledFor: string }
  | { status: "unsupported"; message: string }
  | { status: "denied"; message: string }
  | { status: "error"; message: string };

function getNotificationsModule():
  | typeof import("expo-notifications")
  | null {
  try {
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

export function parseReminderDestination(value: unknown): ReminderDestination | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "practiceDue") return { kind: "practiceDue" };
  if (record.kind === "journey") return { kind: "journey" };
  if (
    record.kind === "resumeStory" &&
    typeof record.bookSlug === "string" &&
    typeof record.storySlug === "string"
  ) {
    return {
      kind: "resumeStory",
      bookSlug: record.bookSlug,
      storySlug: record.storySlug,
    };
  }
  return null;
}

async function clearExistingReminderSchedules(
  Notifications: typeof import("expo-notifications")
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.tag === DAILY_LOOP_REMINDER_TAG)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

function buildNextReminderDate(hour: number, activeToday: boolean): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);

  if (activeToday || next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export async function syncDailyReminderSchedule(args: {
  enabled: boolean;
  hour: number | null;
  learningGoal: OnboardingGoal | null;
  dailyMinutes: number | null;
  context?: DailyReminderContext | null;
  activeToday?: boolean;
  requestPermissions?: boolean;
}): Promise<ReminderScheduleState> {
  const {
    enabled,
    hour,
    learningGoal,
    dailyMinutes,
    context,
    activeToday = false,
    requestPermissions = false,
  } = args;
  const Notifications = getNotificationsModule();

  if (!Notifications) {
    return {
      status: "unsupported",
      message: "Daily reminders will be available after the next native rebuild.",
    };
  }

  try {
    await clearExistingReminderSchedules(Notifications);

    if (!enabled || hour === null) {
      return { status: "disabled", message: "Daily reminders are off." };
    }

    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== "granted" && requestPermissions) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") {
      return {
        status: "denied",
        message: "Notification permission is off for this device.",
      };
    }

    const copy = buildDailyReminderCopy({ learningGoal, dailyMinutes, context });
    const nextReminderAt = buildNextReminderDate(hour, activeToday);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        sound: true,
        data: { tag: DAILY_LOOP_REMINDER_TAG, target: copy.target },
      },
      trigger: nextReminderAt as never,
    });

    return {
      status: "scheduled",
      message: activeToday
        ? `Daily reminder set for tomorrow at ${formatReminderHour(hour)}.`
        : `Daily reminder set for ${formatReminderHour(hour)}.`,
      scheduledFor: nextReminderAt.toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not schedule daily reminders.",
    };
  }
}
