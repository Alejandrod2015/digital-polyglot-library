// Empuje "al día siguiente": avisa UNA vez a quien terminó un journey y no ha
// abierto el siguiente de su misma cadena.
//
// Reglas de producto, todas comprobadas aquí y no en el que llama:
//   1. La cadena va por TIPO. `Journey.nextJourneyId` puede apuntar a otro
//      tipo (el puntero de Friends A0 ES -> Traveler A1 ES lo hacía); ese par
//      se descarta con motivo `cross_type` en vez de mandar un aviso que
//      manda al usuario a un recorrido con otros personajes y otra ciudad.
//   2. Terminado = TODAS las historias publicadas del journey de origen
//      cuentan como completadas, con la misma regla que la app
//      (`JOURNEY_COMPLETION_EVENT_TYPES` + el 95% de audio).
//   3. "Al día siguiente" no puede ser exacto: los timestamps de UserMetric
//      son de servidor y no sabemos la zona del usuario. La ventana va de 20
//      a 120 horas desde que terminó. El suelo de 20 evita avisar la misma
//      noche; el techo de 120 es el p90 del hueco entre días activos (5
//      días), así que quien se fue callado sigue recibiendo el aviso una vez.
//   4. Solo si NO ha abierto el siguiente: cualquier evento sobre una historia
//      del journey destino lo descarta.
//   5. Una sola vez por par: se deja una fila `journey_bridge_push_sent` en
//      UserMetric. Sin tabla nueva y sin migración, y de paso queda medible
//      junto al resto de eventos.
//
// Entrega: solo iOS. Los tokens de Android se guardan con provider "native" y
// no hay emisor FCM en el proyecto, así que un tester de Android nunca recibe
// esto. Aparece como `androidOnly` en el informe para que no se confunda con
// un fallo de entrega.

import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import { normalizeNotificationPrefs } from "@/lib/notifications";
import {
  JOURNEY_COMPLETION_EVENT_TYPES,
  isCompletedFromAudio,
  toNumber,
} from "@/lib/journeyProgress";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/** Tipo de notificación bajo el que se filtra el opt-in del usuario. */
export const BRIDGE_NOTIFICATION_KEY = "new_content" as const;
/** Evento que marca "a este usuario ya se le avisó de este journey". */
export const BRIDGE_SENT_EVENT = "journey_bridge_push_sent";

export const BRIDGE_MIN_HOURS = 20;
export const BRIDGE_MAX_HOURS = 120;

export type BridgeSkipReason =
  | "cross_type"
  | "target_not_active"
  | "no_stories"
  | "too_soon"
  | "too_late"
  | "opened_next"
  | "already_sent"
  | "opted_out"
  | "no_ios_token";

export type BridgePair = {
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  /** Idioma en el que se lee, ya capitalizado ("Portuguese"). */
  language: string;
  /** Nivel de cada lado, en mayúsculas ("A0", "A1"). */
  fromLevel: string;
  toLevel: string;
  fromSlugs: string[];
  toSlugs: string[];
  /** Historias publicadas a cada lado; el aviso las cuenta. */
  fromCount: number;
  toCount: number;
};

export type BridgeCandidate = {
  userId: string;
  pair: BridgePair;
  completedAt: Date;
  hoursSince: number;
  eligible: boolean;
  skip: BridgeSkipReason | null;
  tokenCount: number;
  androidOnly: boolean;
  title: string;
  body: string;
};

export type BridgeRunReport = {
  now: string;
  dryRun: boolean;
  apnsConfigured: boolean;
  pairs: Array<{ from: string; to: string; skip: BridgeSkipReason | null; finishers: number }>;
  candidates: BridgeCandidate[];
  sent: Array<{ userId: string; toId: string; delivered: number; failed: number }>;
  errors: string[];
};

function languageLabel(language: string | null | undefined): string {
  const raw = (language ?? "").trim();
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function levelLabel(levels: string[] | null | undefined): string {
  return ((levels ?? [])[0] ?? "").toUpperCase();
}

function journeyLabel(journey: { name: string; levels: string[]; variant: string }): string {
  const level = (journey.levels ?? [])[0];
  return level ? `${journey.name} ${level.toUpperCase()}` : journey.name;
}

/**
 * Copy del aviso. En inglés, como el resto de la UI del móvil.
 *
 * Nombra el IDIOMA y el NIVEL, y cuenta historias. La primera versión decía
 * "Traveler A1 is open": ni el idioma ni una idea de qué hay al otro lado, y
 * "Traveler" es la etiqueta del TIPO, no algo que el lector reconozca. El
 * título es una acción, no un estado.
 */
export function bridgeCopy(pair: BridgePair): { title: string; body: string } {
  const to = [pair.language, pair.toLevel].filter(Boolean).join(" ");
  // El aviso habla del contenido que espera, nunca de lo que el alumno hizo o
  // dejó de hacer (regla de voz en `smartNotificationPlan.ts`).
  const stories =
    pair.toCount > 0
      ? `${pair.toCount} new stories, one step up from where you just were.`
      : "New stories, one step up from where you just were.";
  return {
    title: `${to || pair.toLabel} is open`,
    body: stories,
  };
}

/**
 * Pares origen -> destino que hoy pueden generar aviso, ya filtrados por la
 * regla de tipo y por el estado del destino.
 */
export async function getBridgePairs(): Promise<{
  pairs: BridgePair[];
  rejected: Array<{ from: string; to: string; skip: BridgeSkipReason }>;
}> {
  const journeys = await prisma.journey.findMany({
    select: {
      id: true,
      name: true,
      levels: true,
      variant: true,
      language: true,
      typeSlug: true,
      status: true,
      nextJourneyId: true,
    },
  });
  const byId = new Map(journeys.map((j) => [j.id, j]));

  const withPointer = journeys.filter((j) => j.status === "active" && j.nextJourneyId);
  const pairs: BridgePair[] = [];
  const rejected: Array<{ from: string; to: string; skip: BridgeSkipReason }> = [];

  const ids = new Set<string>();
  for (const from of withPointer) {
    const to = byId.get(from.nextJourneyId!);
    if (!to) continue;
    ids.add(from.id);
    ids.add(to.id);
  }

  const stories = ids.size
    ? await prisma.journeyStory.findMany({
        where: { journeyId: { in: [...ids] }, status: "published", slug: { not: null } },
        select: { journeyId: true, slug: true },
      })
    : [];
  const slugsByJourney = new Map<string, string[]>();
  for (const story of stories) {
    if (!story.slug) continue;
    const list = slugsByJourney.get(story.journeyId) ?? [];
    list.push(story.slug);
    slugsByJourney.set(story.journeyId, list);
  }

  for (const from of withPointer) {
    const to = byId.get(from.nextJourneyId!);
    if (!to) continue;
    const label = { from: journeyLabel(from), to: journeyLabel(to) };

    // Regla 1: la cadena va por tipo. Sin typeSlug en alguno de los dos no se
    // puede afirmar que sean el mismo, así que tampoco se manda.
    if (!from.typeSlug || !to.typeSlug || from.typeSlug !== to.typeSlug) {
      rejected.push({ ...label, skip: "cross_type" });
      continue;
    }
    if (to.status !== "active") {
      rejected.push({ ...label, skip: "target_not_active" });
      continue;
    }
    const fromSlugs = slugsByJourney.get(from.id) ?? [];
    const toSlugs = slugsByJourney.get(to.id) ?? [];
    if (fromSlugs.length === 0 || toSlugs.length === 0) {
      rejected.push({ ...label, skip: "no_stories" });
      continue;
    }

    pairs.push({
      fromId: from.id,
      fromLabel: label.from,
      toId: to.id,
      toLabel: label.to,
      language: languageLabel(from.language),
      fromLevel: levelLabel(from.levels),
      toLevel: levelLabel(to.levels),
      fromSlugs,
      toSlugs,
      fromCount: fromSlugs.length,
      toCount: toSlugs.length,
    });
  }

  return { pairs, rejected };
}

/**
 * Para un par, quién ha terminado el origen y cuándo. Devuelve TODOS los que
 * terminaron, sin filtrar por ventana, para que el informe en seco muestre
 * también a los que aún no tocan.
 */
export async function getFinishers(pair: BridgePair): Promise<Map<string, Date>> {
  const rows = await prisma.userMetric.findMany({
    where: {
      storySlug: { in: pair.fromSlugs },
      eventType: { in: [...JOURNEY_COMPLETION_EVENT_TYPES] },
    },
    select: { userId: true, storySlug: true, eventType: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const doneByUser = new Map<string, Map<string, Date>>();
  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const complete =
      row.eventType === "audio_complete" ||
      (metadata !== null &&
        isCompletedFromAudio(toNumber(metadata.progressSec), toNumber(metadata.audioDurationSec)));
    if (!complete) continue;
    const perUser = doneByUser.get(row.userId) ?? new Map<string, Date>();
    if (!perUser.has(row.storySlug)) perUser.set(row.storySlug, row.createdAt);
    doneByUser.set(row.userId, perUser);
  }

  const finishers = new Map<string, Date>();
  for (const [userId, perUser] of doneByUser) {
    if (perUser.size < pair.fromSlugs.length) continue;
    // Terminó cuando cerró la ÚLTIMA que le faltaba.
    const completedAt = [...perUser.values()].reduce((a, b) => (a > b ? a : b));
    finishers.set(userId, completedAt);
  }
  return finishers;
}

/**
 * Progreso parcial por par: cuántas historias del origen lleva cada usuario.
 * Sin esto, un informe de cero candidatos no distingue "la consulta no
 * encuentra a nadie" de "nadie ha terminado todavía", que es justo el estado
 * de hoy (el tester más avanzado va 13/21).
 */
export async function getPartialProgress(
  pair: BridgePair,
  topN = 3,
): Promise<{ total: number; top: Array<{ userId: string; done: number }> }> {
  const rows = await prisma.userMetric.findMany({
    where: {
      storySlug: { in: pair.fromSlugs },
      eventType: { in: [...JOURNEY_COMPLETION_EVENT_TYPES] },
    },
    select: { userId: true, storySlug: true },
  });
  const byUser = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = byUser.get(row.userId) ?? new Set<string>();
    set.add(row.storySlug);
    byUser.set(row.userId, set);
  }
  const top = [...byUser.entries()]
    .map(([userId, set]) => ({ userId, done: set.size }))
    .sort((a, b) => b.done - a.done)
    .slice(0, topN);
  return { total: pair.fromSlugs.length, top };
}

async function alreadySentUserIds(toId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.userMetric.findMany({
    where: { eventType: BRIDGE_SENT_EVENT, storySlug: toId, userId: { in: userIds } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

async function openedNextUserIds(pair: BridgePair, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.userMetric.findMany({
    where: { storySlug: { in: pair.toSlugs }, userId: { in: userIds } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

async function getIosTokens(userId: string): Promise<{ tokens: string[]; androidOnly: boolean; optedIn: boolean }> {
  const user = await clerkClient.users.getUser(userId);
  const publicMeta = (user.publicMetadata as Record<string, unknown>) ?? {};
  const prefs = normalizeNotificationPrefs(
    publicMeta.notificationPrefs,
    publicMeta.remindersEnabled === true,
  );
  const raw = ((user.privateMetadata as Record<string, unknown>) ?? {}).mobilePushTokens;
  const entries = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  const tokens: string[] = [];
  let other = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const value = typeof entry.token === "string" ? entry.token.trim() : "";
    if (!value) continue;
    if (entry.provider === "apns") tokens.push(value);
    else other += 1;
  }
  return { tokens, androidOnly: tokens.length === 0 && other > 0, optedIn: prefs[BRIDGE_NOTIFICATION_KEY] === true };
}

/**
 * Envío de PRUEBA a un solo usuario, con el texto real del aviso. No mira la
 * ventana, no mira si terminó nada y NO deja el sello de "ya avisado", así que
 * se puede repetir. Existe para probarlo en un teléfono propio antes de que
 * exista una cadena con destino publicado; el cron nunca llama a esto.
 */
export async function sendBridgeTest(args: {
  userId: string;
  toJourneyId?: string;
}): Promise<{ ok: boolean; title?: string; body?: string; delivered?: number; failed?: number; error?: string }> {
  if (!isApnsConfigured()) return { ok: false, error: "APNs sin configurar" };

  const journeys = await prisma.journey.findMany({
    select: { id: true, name: true, levels: true, variant: true, language: true, nextJourneyId: true, status: true },
  });
  const byId = new Map(journeys.map((j) => [j.id, j]));
  const origen =
    (args.toJourneyId
      ? journeys.find((j) => j.nextJourneyId === args.toJourneyId)
      : journeys.find((j) => j.nextJourneyId)) ?? null;
  const destino = args.toJourneyId
    ? byId.get(args.toJourneyId)
    : origen?.nextJourneyId
      ? byId.get(origen.nextJourneyId)
      : null;
  if (!destino) return { ok: false, error: "No hay journey destino que anunciar" };

  // Las cuentas salen de la base también en la prueba: un aviso de muestra que
  // dice "all 0 stories" no sirve para juzgar el texto.
  const [fromCount, toCount] = await Promise.all([
    origen
      ? prisma.journeyStory.count({ where: { journeyId: origen.id, status: "published", slug: { not: null } } })
      : Promise.resolve(0),
    prisma.journeyStory.count({ where: { journeyId: destino.id, status: "published", slug: { not: null } } }),
  ]);

  const pair: BridgePair = {
    fromId: origen?.id ?? destino.id,
    fromLabel: origen ? journeyLabel(origen) : "your journey",
    toId: destino.id,
    toLabel: journeyLabel(destino),
    language: languageLabel(destino.language),
    fromLevel: levelLabel(origen?.levels),
    toLevel: levelLabel(destino.levels),
    fromSlugs: [],
    toSlugs: [],
    fromCount,
    toCount,
  };
  const copy = bridgeCopy(pair);

  const { tokens, androidOnly, optedIn } = await getIosTokens(args.userId);
  if (!optedIn) return { ok: false, error: `El usuario tiene ${BRIDGE_NOTIFICATION_KEY} desactivado`, ...copy };
  if (tokens.length === 0) {
    return {
      ok: false,
      error: androidOnly ? "Solo hay token de Android y no hay emisor FCM" : "Sin token de iOS registrado",
      ...copy,
    };
  }

  const results = await sendApnsPush(tokens, {
    title: copy.title,
    body: copy.body,
    data: { notificationType: BRIDGE_NOTIFICATION_KEY, journeyId: destino.id, language: pair.language, test: true },
  });
  const delivered = results.filter((r) => r.ok).length;
  return { ok: delivered > 0, ...copy, delivered, failed: results.length - delivered, error: results.find((r) => !r.ok)?.reason };
}

/**
 * Calcula candidatos y, si `dryRun` es false Y el interruptor de entorno está
 * encendido, manda el aviso. Por defecto NO manda: es una acción hacia fuera y
 * el valor por defecto seguro es contar, no escribir a nadie.
 */
export async function runJourneyBridgePush(args?: {
  dryRun?: boolean;
  now?: Date;
}): Promise<BridgeRunReport> {
  const now = args?.now ?? new Date();
  const enabled = /^(1|true|yes)$/i.test(process.env.JOURNEY_BRIDGE_PUSH_ENABLED?.trim() ?? "");
  const dryRun = args?.dryRun ?? !enabled;

  const report: BridgeRunReport = {
    now: now.toISOString(),
    dryRun,
    apnsConfigured: isApnsConfigured(),
    pairs: [],
    candidates: [],
    sent: [],
    errors: [],
  };

  const { pairs, rejected } = await getBridgePairs();
  for (const r of rejected) report.pairs.push({ from: r.from, to: r.to, skip: r.skip, finishers: 0 });

  for (const pair of pairs) {
    const finishers = await getFinishers(pair);
    report.pairs.push({ from: pair.fromLabel, to: pair.toLabel, skip: null, finishers: finishers.size });
    if (finishers.size === 0) continue;

    const userIds = [...finishers.keys()];
    const [sentAlready, opened] = await Promise.all([
      alreadySentUserIds(pair.toId, userIds),
      openedNextUserIds(pair, userIds),
    ]);

    for (const [userId, completedAt] of finishers) {
      const hoursSince = (now.getTime() - completedAt.getTime()) / 3_600_000;
      const copy = bridgeCopy(pair);
      const candidate: BridgeCandidate = {
        userId,
        pair,
        completedAt,
        hoursSince: Math.round(hoursSince * 10) / 10,
        eligible: false,
        skip: null,
        tokenCount: 0,
        androidOnly: false,
        ...copy,
      };

      if (sentAlready.has(userId)) candidate.skip = "already_sent";
      else if (opened.has(userId)) candidate.skip = "opened_next";
      else if (hoursSince < BRIDGE_MIN_HOURS) candidate.skip = "too_soon";
      else if (hoursSince > BRIDGE_MAX_HOURS) candidate.skip = "too_late";

      if (!candidate.skip) {
        try {
          const { tokens, androidOnly, optedIn } = await getIosTokens(userId);
          candidate.tokenCount = tokens.length;
          candidate.androidOnly = androidOnly;
          if (!optedIn) candidate.skip = "opted_out";
          else if (tokens.length === 0) candidate.skip = "no_ios_token";
          else candidate.eligible = true;
        } catch (err) {
          report.errors.push(`clerk ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      report.candidates.push(candidate);

      if (!candidate.eligible || dryRun) continue;
      if (!report.apnsConfigured) {
        report.errors.push("APNs sin configurar; no se manda nada.");
        continue;
      }

      try {
        const { tokens } = await getIosTokens(userId);
        const results = await sendApnsPush(tokens, {
          title: candidate.title,
          body: candidate.body,
          // `language` viaja porque la app tiene que cambiar de idioma antes de
          // poder seleccionar el track; sin él, tocar el aviso desde otro
          // idioma no encuentra el journey.
          data: { notificationType: BRIDGE_NOTIFICATION_KEY, journeyId: pair.toId, language: pair.language },
        });
        const delivered = results.filter((r) => r.ok).length;
        // El sello va aunque falle la entrega: si el token está muerto,
        // reintentarlo cada noche no lo resucita y sí duplica el aviso el día
        // que el usuario reinstala.
        await prisma.userMetric.create({
          data: {
            userId,
            storySlug: pair.toId,
            eventType: BRIDGE_SENT_EVENT,
            value: delivered,
            metadata: { fromJourneyId: pair.fromId, toJourneyId: pair.toId, hoursSince: candidate.hoursSince },
          },
        });
        report.sent.push({ userId, toId: pair.toId, delivered, failed: results.length - delivered });
      } catch (err) {
        report.errors.push(`apns ${userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return report;
}
