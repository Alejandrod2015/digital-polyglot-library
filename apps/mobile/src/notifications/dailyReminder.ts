import {
  buildDailyReminderCopy,
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

function formatHM(hour: number, minute: number): string {
  const normalizedHour = ((Math.trunc(hour) % 24) + 24) % 24;
  const min = ((Math.trunc(minute) % 60) + 60) % 60;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour}:${min.toString().padStart(2, "0")} ${suffix}`;
}

export async function syncDailyReminderSchedule(args: {
  enabled: boolean;
  hour: number | null;
  /** Minuto del día (0/15/30/45). Default 0. */
  minute?: number | null;
  learningGoal: OnboardingGoal | null;
  dailyMinutes: number | null;
  context?: DailyReminderContext | null;
  activeToday?: boolean;
  requestPermissions?: boolean;
}): Promise<ReminderScheduleState> {
  const {
    enabled,
    hour,
    minute,
    learningGoal,
    dailyMinutes,
    context,
    requestPermissions = false,
  } = args;
  const resolvedMinute = typeof minute === "number" && Number.isFinite(minute) ? minute : 0;
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
    // Trigger DAILY-recurring (repeats every day). Antes pasábamos un Date
    // único (`trigger: nextReminderAt as never`), lo que disparaba la
    // notificación una sola vez y no se repetía — el usuario nunca recibía
    // el reminder al día siguiente. Con `{ type: "daily", hour, minute,
    // repeats: true }` iOS programa una entrada que dispara cada día a la
    // hora local del device.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        sound: true,
        data: { tag: DAILY_LOOP_REMINDER_TAG, target: copy.target },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      trigger: { type: "daily", hour, minute: resolvedMinute, repeats: true } as any,
    });

    return {
      status: "scheduled",
      message: `Daily reminder set for ${formatHM(hour, resolvedMinute)}.`,
      scheduledFor: formatHM(hour, resolvedMinute),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not schedule daily reminders.",
    };
  }
}
