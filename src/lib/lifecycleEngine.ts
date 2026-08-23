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

/**
 * Testers que ahora mismo lleva el cron de beta.
 *
 * Un tester es también un usuario normal, así que hasta el 2026-08-24 recibía
 * las DOS cadenas a la vez, y los dos crons corren el mismo día con dos horas
 * de diferencia (09:00 y 11:00 UTC). El 23-ago una persona recibió "Has
 * terminado tu primera historia" a las 09:00 y "La beta se cierra, gracias por
 * estas últimas semanas" a las 11:01, en su primer día dentro. Otros cinco
 * encadenaron el aviso de "te faltan 2 minutos" con la encuesta final del día
 * siguiente.
 *
 * El predicado es el mismo que usa `runBetaLifecycle`, a propósito: a quien
 * escribe el cron de beta no le escribe nadie más. Al revocarle el plan cae de
 * los dos filtros y la cadena general lo recoge otra vez, sin nada que tocar.
 */
async function getActiveBetaTesterIds(): Promise<string[]> {
  const rows = await prisma.betaSignup.findMany({
    where: {
      status: { in: ["invited", "accepted"] },
      planRevokedAt: null,
      clerkUserId: { not: null },
    },
    select: { clerkUserId: true },
  });
  return rows.map((r) => r.clerkUserId).filter((id): id is string => Boolean(id));
}

export async function runLifecycleEmails(now: Date): Promise<LifecycleRunResult> {
  const internal = new Set(await getInternalUserIds().catch(() => []));

  // Fail-closed, al revés que `internal`: si esta consulta falla no sabemos
  // quién es tester, y la forma barata de equivocarse es callar hoy. La cara es
  // apilar esta cadena encima de la de beta, que es justo el fallo que esto
  // arregla.
  const betaTesters = await getActiveBetaTesterIds().catch((err) => {
    console.error("No se pudo leer la lista de testers; hoy no sale nada:", err);
    return null;
  });
  if (betaTesters === null) return { scanned: 0, sent: [], skipped: 0 };
  const inBeta = new Set(betaTesters);

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
    if (inBeta.has(s.userId)) continue;
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
