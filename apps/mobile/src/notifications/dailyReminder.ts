import {
  buildDailyReminderCopy,
  type DailyReminderContext,
  type ReminderDestination,
} from "@/lib/reminders";
import type { OnboardingGoal } from "@/lib/onboarding";

export type { ReminderDestination } from "@/lib/reminders";

const DAILY_LOOP_REMINDER_TAG = "daily-loop-reminder";
// Identificador FIJO del unico recordatorio diario. Sin el, cada
// `scheduleNotificationAsync` recibia un UUID nuevo (expo hace
// `request.identifier ?? uuid.v4()`), asi que dos llamadas solapadas
// dejaban DOS entradas programadas y el usuario recibia el mismo aviso
// dos veces cada dia. Con un id fijo, el store nativo REEMPLAZA la
// entrada en vez de anadir otra, pase lo que pase con las carreras.
const DAILY_LOOP_REMINDER_ID = "daily-loop-reminder";

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
  if (record.kind === "journeyStory" && typeof record.storySlug === "string" && record.storySlug.trim()) {
    return { kind: "journeyStory", storySlug: record.storySlug.trim() };
  }
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
  Notifications: typeof import("expo-notifications"),
  /** Deja viva la entrada con el id fijo cuando vamos a reprogramarla. */
  keepCanonical: boolean
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => {
        const isOurs =
          request.identifier === DAILY_LOOP_REMINDER_ID ||
          request.content.data?.tag === DAILY_LOOP_REMINDER_TAG;
        if (!isOurs) return false;
        // Las entradas viejas con UUID aleatorio (las que duplicaban el
        // aviso) se borran siempre; la canonica solo cuando apagamos.
        if (keepCanonical && request.identifier === DAILY_LOOP_REMINDER_ID) return false;
        return true;
      })
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
  );
}

// Cola de un solo carril. `syncDailyReminderSchedule` se llama desde tres
// sitios (hidratacion de preferencias, guardado, y un efecto que depende de
// `dailyReminderContext`, que cambia de identidad mientras carga el track), y
// nada impedia que se solaparan: dos limpiezas leian la lista ANTES de que la
// otra programara, ninguna cancelaba a la otra, y quedaban dos o tres avisos
// identicos. Serializar las llamadas hace que cada una vea el estado real.
let reminderSyncChain: Promise<unknown> = Promise.resolve();

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = reminderSyncChain.then(task, task);
  reminderSyncChain = next.catch(() => undefined);
  return next;
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

  return runSerialized(async (): Promise<ReminderScheduleState> => {
  try {
    await clearExistingReminderSchedules(Notifications, enabled && hour !== null);

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
    // notificación una sola vez y no se repetía; el usuario nunca recibía
    // el reminder al día siguiente. Con `{ type: "daily", hour, minute,
    // repeats: true }` iOS programa una entrada que dispara cada día a la
    // hora local del device.
    await Notifications.scheduleNotificationAsync({
      // Id fijo: reprogramar REEMPLAZA la entrada anterior en vez de
      // anadir otra. Es lo que impide que un solape deje dos avisos.
      identifier: DAILY_LOOP_REMINDER_ID,
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
  });
}
