// Lifecycle email engine. Run daily by the cron at /api/cron/lifecycle-emails.
// For each recent signup it computes the user's real state (account age,
// activity, stories finished) and sends the ONE lifecycle email that applies,
// using real per-user data. Idempotent: each kind is sent at most once per user
// (tracked via a `lifecycle_email_sent` UserMetric).

import { prisma } from "@/lib/prisma";
import { getInternalUserIds } from "@/lib/metricsAccess";
import { getProgressPayloadCached } from "@/lib/progressPayload";
import { sendLifecycleEmail } from "@/lib/email";
import { buildLifecycleData } from "@/lib/emails/userLifecycleData";
import { hasRealDataFor, type LifecycleKind } from "@/lib/emails/lifecycle";

const DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 60;
const MAX_USERS = 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY);
}

/** Which kinds have already been sent to this user (idempotency). */
async function getSentKinds(userId: string): Promise<Set<string>> {
  try {
    const rows = await prisma.userMetric.findMany({
      where: { userId, eventType: "lifecycle_email_sent" },
      select: { metadata: true },
    });
    const set = new Set<string>();
    for (const r of rows) {
      const k = (r.metadata as { kind?: string } | null)?.kind;
      if (k) set.add(k);
    }
    return set;
  } catch {
    return new Set();
  }
}

async function recordSent(userId: string, kind: LifecycleKind, to: string): Promise<void> {
  try {
    await prisma.userMetric.create({
      data: {
        userId,
        eventType: "lifecycle_email_sent",
        storySlug: "__email__",
        bookSlug: "lifecycle",
        metadata: { kind, to },
      },
    });
  } catch {
    /* best effort */
  }
}

/**
 * Testers de la beta, por su id de Clerk. Solo se usa para NO mandarles la
 * bienvenida: ya recibieron el correo de aceptacion, que les dice que hacer en
 * terminos de la beta, y dos bienvenidas con instrucciones distintas se leen
 * como una averia. Esta exclusion vivia en el webhook de `user.created`; se
 * mudo aqui junto con el envio.
 *
 * El resto de correos del ciclo de vida SI les llegan, como hasta ahora.
 */
async function getBetaTesterUserIds(): Promise<Set<string>> {
  try {
    const rows = await prisma.betaSignup.findMany({
      where: { clerkUserId: { not: null } },
      select: { clerkUserId: true },
    });
    return new Set(rows.map((r) => r.clerkUserId!).filter(Boolean));
  } catch {
    return new Set();
  }
}

/** Most recent activity timestamp (story listening). */
async function getLastActiveAt(userId: string): Promise<Date | null> {
  try {
    const row = await prisma.continueListeningEntry.findFirst({
      where: { userId },
      select: { lastPlayedAt: true },
      orderBy: { lastPlayedAt: "desc" },
    });
    return row?.lastPlayedAt ?? null;
  } catch {
    return null;
  }
}

/**
 * Decide the single lifecycle email a user should get right now, or null.
 * Behavioral + time windows; idempotency is enforced by the caller.
 */
export function decideKind(args: {
  daysSinceSignup: number;
  storiesFinished: number;
  daysSinceActive: number | null;
  alreadySent: Set<string>;
}): LifecycleKind | null {
  const { daysSinceSignup, storiesFinished, daysSinceActive, alreadySent } = args;
  const not = (k: LifecycleKind) => !alreadySent.has(k);

  // Win-back series: dormant 30+ days, escalating. Highest priority (re-engage).
  if (daysSinceActive !== null) {
    if (daysSinceActive >= 45 && not("winSunset")) return "winSunset";
    if (daysSinceActive >= 38 && not("winValue")) return "winValue";
    if (daysSinceActive >= 30 && not("winReminder")) return "winReminder";
  }

  // Celebration: finished their first story (behavioral), once.
  if (storiesFinished >= 1 && not("celebration")) return "celebration";

  // Bienvenida. Vive aqui, y no en el webhook de `user.created`, por dos
  // razones que se vieron el 2026-09-07:
  //
  //  1. En el instante del alta no sabemos ni idioma ni nivel, asi que el
  //     correo no puede elegir una historia y acababa apuntando a un slug de
  //     demostracion que da 404.
  //  2. En ese instante el usuario esta DENTRO de la app (del alta a la
  //     primera historia pasan unos tres minutos), asi que el correo compite
  //     con la pantalla que ya tiene delante.
  //
  // Al correr por aqui, el onboarding ya termino y `buildLifecycleData` tiene
  // idioma y nivel: el boton apunta a una historia publicada de verdad. Y la
  // idempotencia sale gratis, via `getSentKinds`.
  //
  // `storiesFinished === 0` la deja fuera de quien ya esta leyendo (ese recibe
  // `celebration`, arriba), y el tope de dos dias evita que una bienvenida
  // aparezca semanas despues.
  if (daysSinceSignup <= 2 && storiesFinished === 0 && not("welcome")) return "welcome";

  // Activation nudge: 1-3 days in and still hasn't finished a story.
  if (daysSinceSignup >= 1 && daysSinceSignup <= 3 && storiesFinished === 0 && not("nudge"))
    return "nudge";

  // Weekly recap: ~day 7, with some activity.
  if (daysSinceSignup >= 7 && daysSinceSignup <= 9 && storiesFinished >= 1 && not("recap"))
    return "recap";

  // Identity: ~day 10-14, engaged.
  if (daysSinceSignup >= 10 && daysSinceSignup <= 15 && storiesFinished >= 1 && not("next"))
    return "next";

  return null;
}

export type LifecycleRunResult = {
  scanned: number;
  sent: { kind: LifecycleKind; userId: string }[];
  skipped: number;
};

export async function runLifecycleEmails(now: Date): Promise<LifecycleRunResult> {
  const internal = new Set(await getInternalUserIds().catch(() => []));
  const betaTesters = await getBetaTesterUserIds();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY);

  const signups = await prisma.userMetric.findMany({
    where: { eventType: "signup_completed", createdAt: { gte: since } },
    select: { userId: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_USERS,
  });

  // Dedupe by userId (keep earliest signup row per user).
  const byUser = new Map<string, { metadata: unknown; createdAt: Date }>();
  for (const s of signups) {
    if (internal.has(s.userId)) continue;
    const prev = byUser.get(s.userId);
    if (!prev || s.createdAt < prev.createdAt) {
      byUser.set(s.userId, { metadata: s.metadata, createdAt: s.createdAt });
    }
  }

  const result: LifecycleRunResult = { scanned: byUser.size, sent: [], skipped: 0 };

  for (const [userId, info] of byUser) {
    const email = (info.metadata as { email?: string } | null)?.email;
    if (!email) {
      result.skipped++;
      continue;
    }

    const [sentKinds, progress, lastActiveAt] = await Promise.all([
      getSentKinds(userId),
      getProgressPayloadCached(userId).catch(() => null),
      getLastActiveAt(userId),
    ]);

    const kind = decideKind({
      daysSinceSignup: daysBetween(now, info.createdAt),
      storiesFinished: progress?.storiesFinished ?? 0,
      daysSinceActive: lastActiveAt ? daysBetween(now, lastActiveAt) : null,
      alreadySent: sentKinds,
    });

    if (!kind) {
      result.skipped++;
      continue;
    }

    // Ver `getBetaTesterUserIds`: al tester le llega el correo de aceptacion,
    // no la bienvenida.
    if (kind === "welcome" && betaTesters.has(userId)) {
      result.skipped++;
      continue;
    }

    const data = await buildLifecycleData(userId);

    if (!hasRealDataFor(kind, data)) {
      result.skipped++;
      continue;
    }

    const res = await sendLifecycleEmail({ kind, to: email, data });
    if (res === "sent") {
      await recordSent(userId, kind, email);
      result.sent.push({ kind, userId });
    } else {
      result.skipped++;
    }
  }

  return result;
}
