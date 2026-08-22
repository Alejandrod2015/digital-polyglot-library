// Aviso de "historia a medias": el alumno dejó una historia por la mitad y no
// ha vuelto. Es el disparador 1 del plan (`smartNotificationPlan.ts`).
//
// Reglas de producto, todas comprobadas aquí y no en el que llama:
//   1. A medias de verdad: entre el 20% y el 85% del audio. Por debajo del 20%
//      no llegó a engancharse y el aviso suena a insistencia; por encima del
//      85% la app ya lo trata como terminada (`isCompletedFromAudio`).
//   2. Parada, no en curso: entre 48 horas y 21 días desde `lastPlayedAt`. El
//      suelo de 48 h evita avisar a quien la retomará esta tarde; el techo de
//      21 días es donde el aviso deja de ser un recordatorio y pasa a ser
//      arqueología.
//   3. Descarta si la terminó (`audio_complete` posterior, aunque la fila siga
//      a medias) o si volvió en una sesión NUEVA. Los eventos que llegan en los
//      30 minutos siguientes al último guardado son de la misma sesión y no
//      cuentan: tomarlos por una vuelta se comía 43 de 48 filas.
//   4. Una sola vez por historia y usuario, marcada con una fila
//      `resume_story_push_sent` en UserMetric. Sin tabla nueva, y de paso
//      queda medible junto al resto.
//   5. Como mucho UN aviso de este tipo por usuario cada 7 días, aunque tenga
//      cinco historias a medias. El tope global del plan (3 push por semana)
//      se apoya en este.
//   6. Solo historias de journey. Son las únicas que la app sabe abrir desde
//      un aviso (viaja `journeyId`, que el móvil ya entiende). Las de catálogo
//      y las sueltas se cuentan en el informe con motivo `no_deep_link` para
//      que se vea qué nos estamos dejando, no para esconderlo.
//
// Entrega: solo iOS, igual que el puente. Los tokens de Android se guardan con
// provider "native" y no hay emisor FCM en el proyecto.

import { prisma } from "@/lib/prisma";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import { getUserPushTarget } from "@/lib/pushRecipients";

/** Tipo de notificación bajo el que se filtra el opt-in del usuario. */
export const RESUME_NOTIFICATION_KEY = "daily_reminder" as const;
/** Evento que marca "a este usuario ya se le recordó esta historia". */
export const RESUME_SENT_EVENT = "resume_story_push_sent";

export const RESUME_MIN_RATIO = 0.2;
export const RESUME_MAX_RATIO = 0.85;
export const RESUME_MIN_HOURS = 48;
export const RESUME_MAX_HOURS = 24 * 21;
/** Días que tienen que pasar entre dos avisos de este tipo al mismo usuario. */
export const RESUME_COOLDOWN_DAYS = 7;
/**
 * Los eventos que caen dentro de esta ventana tras la última escucha son de la
 * MISMA sesión (la app guarda progreso y evento casi a la vez), no una vuelta.
 */
export const RESUME_SAME_SESSION_MINUTES = 30;

export type ResumeSkipReason =
  | "no_duration"
  | "out_of_band"
  | "too_soon"
  | "too_late"
  | "completed"
  | "resumed"
  | "already_sent"
  | "cooldown"
  | "no_deep_link"
  | "opted_out"
  | "no_ios_token";

export type ResumeCandidate = {
  userId: string;
  bookSlug: string;
  storySlug: string;
  storyTitle: string | null;
  journeyId: string | null;
  language: string | null;
  progressSec: number;
  audioDurationSec: number;
  /** Cuánto del audio lleva oído, de 0 a 1. */
  ratio: number;
  minutesLeft: number;
  hoursSince: number;
  eligible: boolean;
  skip: ResumeSkipReason | null;
  tokenCount: number;
  androidOnly: boolean;
  title: string;
  body: string;
};

export type ResumeRunReport = {
  now: string;
  dryRun: boolean;
  apnsConfigured: boolean;
  /** Filas miradas antes de filtrar nada. */
  rows: number;
  candidates: ResumeCandidate[];
  sent: Array<{ userId: string; storySlug: string; delivered: number; failed: number }>;
  errors: string[];
};

/**
 * Copy del aviso. Habla de la historia, nunca de lo que el alumno dejó a
 * medias: "El mercado is still open", no "You stopped halfway". La regla y sus
 * seis parejas viven en `PLAN_COPY_VOICE` (`smartNotificationPlan.ts`).
 */
export function resumeCopy(args: { storyTitle: string | null; minutesLeft: number }): {
  title: string;
  body: string;
} {
  const name = (args.storyTitle ?? "").trim();
  const minutes = Math.max(1, Math.round(args.minutesLeft));
  // Casi todas las historias de journey duran alrededor de un minuto, así que
  // "1 minutes to the end" sería el texto normal y no la excepción: por debajo
  // de dos minutos el aviso habla del final, no del cronometro.
  return {
    title: name ? `${name} is still open` : "Your story is still open",
    body:
      minutes < 2
        ? "The ending is a minute away, whenever you feel like it."
        : `${minutes} minutes to the end, whenever you feel like it.`,
  };
}

/** Minutos que faltan para el final, redondeados hacia arriba. */
function minutesLeftOf(progressSec: number, audioDurationSec: number): number {
  return Math.max(0, (audioDurationSec - progressSec) / 60);
}

type StoryInfo = { title: string; journeyId: string; language: string | null };

/**
 * Título, journey e idioma de cada slug, mirando solo historias de journey
 * publicadas: son las únicas que el aviso puede abrir. Un slug que no esté aquí
 * se descarta con `no_deep_link`.
 */
async function resolveJourneyStories(slugs: string[]): Promise<Map<string, StoryInfo>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs }, status: "published" },
    select: { slug: true, title: true, journeyId: true, journey: { select: { language: true } } },
  });
  const out = new Map<string, StoryInfo>();
  for (const row of rows) {
    const slug = row.slug;
    // Sin slug no hay fila en ContinueListeningEntry que casar, y sin título el
    // aviso no puede nombrar la historia, que es lo único que lo salva de
    // sonar generico.
    if (!slug || !row.title) continue;
    const language = row.journey?.language ?? null;
    out.set(slug, {
      title: row.title,
      journeyId: row.journeyId,
      // El móvil necesita el idioma para cargar el payload correcto antes de
      // seleccionar el track; sin él, el toque abre otro journey.
      language: language ? language.charAt(0).toUpperCase() + language.slice(1).toLowerCase() : null,
    });
  }
  return out;
}

/** userId+storySlug que ya recibieron este aviso alguna vez. */
async function alreadySentKeys(pairs: Array<{ userId: string; storySlug: string }>): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();
  const rows = await prisma.userMetric.findMany({
    where: {
      eventType: RESUME_SENT_EVENT,
      userId: { in: [...new Set(pairs.map((p) => p.userId))] },
      storySlug: { in: [...new Set(pairs.map((p) => p.storySlug))] },
    },
    select: { userId: true, storySlug: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${r.storySlug}`));
}

/** Usuarios que recibieron un aviso de este tipo dentro del periodo de espera. */
async function inCooldown(userIds: string[], now: Date): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const since = new Date(now.getTime() - RESUME_COOLDOWN_DAYS * 24 * 3_600_000);
  const rows = await prisma.userMetric.findMany({
    where: { eventType: RESUME_SENT_EVENT, userId: { in: userIds }, createdAt: { gte: since } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/**
 * Qué pasó DESPUÉS de la última escucha, por par userId+storySlug.
 *
 * Distinguir esto importa más de lo que parece. La fila de "seguir escuchando"
 * solo se borra cuando el cliente avisa de que terminó, así que hay filas al
 * 60% de historias que el alumno acabó: el evento `audio_complete` llega
 * décimas de segundo después del último guardado de progreso. Tomar cualquier
 * evento posterior como "volvió" mezclaba los dos casos y, medido sobre los
 * datos de hoy, 43 de 48 filas quedaban descartadas por eventos de la MISMA
 * sesión.
 *
 * - `completed`: hay un `audio_complete`. La historia está terminada aunque la
 *   fila diga otra cosa; no hay nada que recordar.
 * - `resumed`: hay actividad de una sesión NUEVA (más de 30 minutos después).
 *   Volvió por su cuenta.
 * - `null`: solo coletazos de la misma sesión, que no significan nada.
 */
async function laterActivity(
  rows: Array<{ userId: string; storySlug: string; lastPlayedAt: Date }>,
): Promise<Map<string, "completed" | "resumed">> {
  const out = new Map<string, "completed" | "resumed">();
  if (rows.length === 0) return out;
  const oldest = rows.reduce((min, r) => (r.lastPlayedAt < min ? r.lastPlayedAt : min), rows[0].lastPlayedAt);
  const events = await prisma.userMetric.findMany({
    where: {
      userId: { in: [...new Set(rows.map((r) => r.userId))] },
      storySlug: { in: [...new Set(rows.map((r) => r.storySlug))] },
      createdAt: { gt: oldest },
      eventType: { not: RESUME_SENT_EVENT },
    },
    select: { userId: true, storySlug: true, eventType: true, createdAt: true },
  });
  const byKey = new Map<string, Array<{ eventType: string; createdAt: Date }>>();
  for (const e of events) {
    const key = `${e.userId}:${e.storySlug}`;
    const list = byKey.get(key);
    if (list) list.push(e);
    else byKey.set(key, [e]);
  }
  const gapMs = RESUME_SAME_SESSION_MINUTES * 60_000;
  for (const row of rows) {
    const key = `${row.userId}:${row.storySlug}`;
    const list = byKey.get(key);
    if (!list) continue;
    const after = list.filter((e) => e.createdAt > row.lastPlayedAt);
    if (after.length === 0) continue;
    if (after.some((e) => e.eventType === "audio_complete")) {
      out.set(key, "completed");
      continue;
    }
    if (after.some((e) => e.createdAt.getTime() - row.lastPlayedAt.getTime() > gapMs)) {
      out.set(key, "resumed");
    }
  }
  return out;
}

/**
 * Calcula candidatos y, si `dryRun` es false Y el interruptor de entorno está
 * encendido, manda el aviso. Por defecto NO manda: es una acción hacia fuera y
 * el valor por defecto seguro es contar, no escribir a nadie.
 */
export async function runResumeStoryPush(args?: { dryRun?: boolean; now?: Date }): Promise<ResumeRunReport> {
  const now = args?.now ?? new Date();
  const enabled = /^(1|true|yes)$/i.test(process.env.RESUME_STORY_PUSH_ENABLED?.trim() ?? "");
  const dryRun = args?.dryRun ?? !enabled;

  const report: ResumeRunReport = {
    now: now.toISOString(),
    dryRun,
    apnsConfigured: isApnsConfigured(),
    rows: 0,
    candidates: [],
    sent: [],
    errors: [],
  };

  const oldest = new Date(now.getTime() - RESUME_MAX_HOURS * 3_600_000);
  const newest = new Date(now.getTime() - RESUME_MIN_HOURS * 3_600_000);
  const rows = await prisma.continueListeningEntry.findMany({
    where: { lastPlayedAt: { gte: oldest, lte: newest } },
    orderBy: { lastPlayedAt: "desc" },
    select: {
      userId: true,
      bookSlug: true,
      storySlug: true,
      progressSec: true,
      audioDurationSec: true,
      lastPlayedAt: true,
    },
  });
  report.rows = rows.length;
  if (rows.length === 0) return report;

  const [stories, sentAlready, cooldown, later] = await Promise.all([
    resolveJourneyStories([...new Set(rows.map((r) => r.storySlug))]),
    alreadySentKeys(rows.map((r) => ({ userId: r.userId, storySlug: r.storySlug }))),
    inCooldown([...new Set(rows.map((r) => r.userId))], now),
    laterActivity(rows.map((r) => ({ userId: r.userId, storySlug: r.storySlug, lastPlayedAt: r.lastPlayedAt }))),
  ]);

  // Un usuario recibe como mucho un aviso por vuelta, aunque tenga varias a
  // medias: se queda con la más avanzada, que es la que menos cuesta terminar.
  const servedUsers = new Set<string>();

  for (const row of rows) {
    const key = `${row.userId}:${row.storySlug}`;
    const progressSec = row.progressSec ?? 0;
    const audioDurationSec = row.audioDurationSec ?? 0;
    const ratio = audioDurationSec > 0 ? progressSec / audioDurationSec : 0;
    const hoursSince = (now.getTime() - row.lastPlayedAt.getTime()) / 3_600_000;
    const story = stories.get(row.storySlug) ?? null;
    const minutesLeft = minutesLeftOf(progressSec, audioDurationSec);
    const copy = resumeCopy({ storyTitle: story?.title ?? null, minutesLeft });

    const candidate: ResumeCandidate = {
      userId: row.userId,
      bookSlug: row.bookSlug,
      storySlug: row.storySlug,
      storyTitle: story?.title ?? null,
      journeyId: story?.journeyId ?? null,
      language: story?.language ?? null,
      progressSec,
      audioDurationSec,
      ratio: Math.round(ratio * 100) / 100,
      minutesLeft: Math.round(minutesLeft * 10) / 10,
      hoursSince: Math.round(hoursSince * 10) / 10,
      eligible: false,
      skip: null,
      tokenCount: 0,
      androidOnly: false,
      ...copy,
    };

    if (audioDurationSec <= 0) candidate.skip = "no_duration";
    else if (ratio < RESUME_MIN_RATIO || ratio > RESUME_MAX_RATIO) candidate.skip = "out_of_band";
    else if (hoursSince < RESUME_MIN_HOURS) candidate.skip = "too_soon";
    else if (hoursSince > RESUME_MAX_HOURS) candidate.skip = "too_late";
    else if (later.get(key) === "completed") candidate.skip = "completed";
    else if (later.get(key) === "resumed") candidate.skip = "resumed";
    else if (sentAlready.has(key)) candidate.skip = "already_sent";
    else if (cooldown.has(row.userId) || servedUsers.has(row.userId)) candidate.skip = "cooldown";
    else if (!story) candidate.skip = "no_deep_link";

    if (!candidate.skip) {
      try {
        const target = await getUserPushTarget(row.userId, RESUME_NOTIFICATION_KEY);
        candidate.tokenCount = target.tokens.length;
        candidate.androidOnly = target.androidOnly;
        if (!target.optedIn) candidate.skip = "opted_out";
        else if (target.tokens.length === 0) candidate.skip = "no_ios_token";
        else candidate.eligible = true;
      } catch (err) {
        report.errors.push(`clerk ${row.userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    report.candidates.push(candidate);
    if (!candidate.eligible) continue;
    // El cupo se gasta con el candidato elegido, mande o no: en seco sirve para
    // que el informe enseñe un aviso por usuario, que es lo que pasaría de
    // verdad.
    servedUsers.add(row.userId);
    if (dryRun) continue;

    if (!report.apnsConfigured) {
      report.errors.push("APNs sin configurar; no se manda nada.");
      continue;
    }

    try {
      const target = await getUserPushTarget(row.userId, RESUME_NOTIFICATION_KEY);
      const results = await sendApnsPush(target.tokens, {
        title: candidate.title,
        body: candidate.body,
        // `storySlug` y `progressSec` viajan para que la app pueda abrir la
        // historia en el segundo exacto en cuanto el móvil lo soporte; hasta
        // entonces, `journeyId` deja al alumno en su recorrido.
        data: {
          notificationType: RESUME_NOTIFICATION_KEY,
          trigger: "resume_story",
          journeyId: story?.journeyId,
          language: story?.language,
          storySlug: row.storySlug,
          progressSec,
        },
      });
      const delivered = results.filter((r) => r.ok).length;
      // El sello va aunque falle la entrega: reintentar contra un token muerto
      // no lo resucita y sí duplica el aviso el día que reinstale.
      await prisma.userMetric.create({
        data: {
          userId: row.userId,
          bookSlug: row.bookSlug,
          storySlug: row.storySlug,
          eventType: RESUME_SENT_EVENT,
          value: delivered,
          metadata: {
            journeyId: story?.journeyId ?? null,
            ratio: candidate.ratio,
            hoursSince: candidate.hoursSince,
            minutesLeft: candidate.minutesLeft,
          },
        },
      });
      report.sent.push({ userId: row.userId, storySlug: row.storySlug, delivered, failed: results.length - delivered });
    } catch (err) {
      report.errors.push(`apns ${row.userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

/**
 * Envío de PRUEBA a un solo usuario, con el texto real. No mira la ventana ni
 * deja sello, así que se puede repetir. Coge su historia a medias más reciente;
 * si no tiene ninguna, usa una historia publicada cualquiera para poder juzgar
 * el texto en un teléfono.
 */
export async function sendResumeTest(args: {
  userId: string;
  storySlug?: string;
}): Promise<{ ok: boolean; title?: string; body?: string; delivered?: number; failed?: number; error?: string }> {
  if (!isApnsConfigured()) return { ok: false, error: "APNs sin configurar" };

  const entry = args.storySlug
    ? null
    : await prisma.continueListeningEntry.findFirst({
        where: { userId: args.userId },
        orderBy: { lastPlayedAt: "desc" },
        select: { storySlug: true, progressSec: true, audioDurationSec: true },
      });
  const slug = args.storySlug ?? entry?.storySlug ?? null;

  const story = slug
    ? await prisma.journeyStory.findFirst({
        where: { slug, status: "published" },
        select: { slug: true, title: true, journeyId: true, journey: { select: { language: true } } },
      })
    : await prisma.journeyStory.findFirst({
        where: { status: "published", slug: { not: null } },
        select: { slug: true, title: true, journeyId: true, journey: { select: { language: true } } },
      });
  if (!story) return { ok: false, error: "No hay historia de journey publicada que anunciar" };

  const duration = entry?.audioDurationSec ?? 0;
  const progress = entry?.progressSec ?? 0;
  const minutesLeft = duration > progress ? minutesLeftOf(progress, duration) : 4;
  const copy = resumeCopy({ storyTitle: story.title, minutesLeft });

  const target = await getUserPushTarget(args.userId, RESUME_NOTIFICATION_KEY);
  if (!target.optedIn) return { ok: false, error: `El usuario tiene ${RESUME_NOTIFICATION_KEY} desactivado`, ...copy };
  if (target.tokens.length === 0) {
    return {
      ok: false,
      error: target.androidOnly ? "Solo hay token de Android y no hay emisor FCM" : "Sin token de iOS registrado",
      ...copy,
    };
  }

  const language = story.journey?.language ?? null;
  const results = await sendApnsPush(target.tokens, {
    title: copy.title,
    body: copy.body,
    data: {
      notificationType: RESUME_NOTIFICATION_KEY,
      trigger: "resume_story",
      journeyId: story.journeyId,
      language: language ? language.charAt(0).toUpperCase() + language.slice(1).toLowerCase() : undefined,
      storySlug: story.slug,
      test: true,
    },
  });
  const delivered = results.filter((r) => r.ok).length;
  return {
    ok: delivered > 0,
    ...copy,
    delivered,
    failed: results.length - delivered,
    error: results.find((r) => !r.ok)?.reason,
  };
}
