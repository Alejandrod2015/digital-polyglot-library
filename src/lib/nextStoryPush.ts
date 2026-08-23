// Aviso de "la siguiente historia": el alumno terminó una y no ha abierto la
// que sigue en su recorrido. Es el disparador 3 del plan
// (`smartNotificationPlan.ts`, id `next_story_teaser`).
//
// POR QUÉ ESTE Y NO OTRO. Los dos disparadores que ya existían cubren los
// extremos y dejaban fuera el estado más común. El 2026-08-23, sobre la base
// de producción: de 62 filas de "seguir escuchando" en ventana, 20 estaban ya
// terminadas y 21 iban por encima del 85%, es decir, 41 personas que ACABARON
// una historia; solo 6 estaban de verdad a medias, que es lo único que el
// aviso de `resumeStoryPush` sabe mirar. El puente
// (`journeyBridgePush`) espera al otro extremo, a que caigan las 21 historias
// de un journey, cuando la mediana de historias distintas por alumno es 4.
// En medio no había nada, y ahí es donde se van: las cohortes de alta dan 0%
// de vuelta en la semana +1.
//
// Reglas de producto, todas comprobadas aquí y no en el que llama:
//   1. Terminada de verdad: la MISMA regla que usa el puente
//      (`JOURNEY_COMPLETION_EVENT_TYPES` + el 95% de audio). Si se duplicara,
//      un día una contaría el scroll y la otra no.
//   2. Orden de lectura del journey, no del tema suelto: la siguiente es el
//      `slotIndex` que sigue dentro del tema y, si el tema se acabó, la
//      primera del tema siguiente segun `Journey.topics[]`, que es el orden
//      que el alumno ve en la app. El plan decía "la N+1 del mismo tema"; con
//      esa lectura, quien termina la tercera historia de un tema (una de cada
//      tres veces) no recibiría nada, que es justo a quien hay que empujar.
//   3. Ventana de 20 a 120 horas desde que terminó, la misma que el puente.
//      El suelo de 20 evita avisar la misma noche a quien sigue leyendo; el
//      techo de 120 es el p90 del hueco entre días activos.
//   4. Descarta si ya abrió la siguiente: cualquier evento sobre ese slug.
//   5. Una sola vez por historia destino, marcada con una fila
//      `next_story_push_sent` en UserMetric. Sin tabla nueva.
//   6. Como mucho uno de este tipo cada 72 horas por usuario, que es la regla
//      general del plan ("nunca dos del mismo tipo en 72 horas"). Aquí no
//      valen los 7 días del aviso de historia a medias: quien lee tres
//      historias en una tarde tiene tres finales, y esperar una semana entre
//      avisos deja pasar justo la racha que se quiere sostener.
//   7. Solo journeys publicados (`status: active`). El siguiente capítulo de
//      un borrador no existe para el alumno.
//   8. Si no queda ninguna historia por delante, no es asunto de este aviso:
//      se descarta con `journey_finished` y lo recoge el puente.
//
// Entrega: solo iOS, igual que los otros dos. Los tokens de Android se guardan
// con provider "native" y no hay emisor FCM en el proyecto.

import { prisma } from "@/lib/prisma";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import {
  JOURNEY_COMPLETION_EVENT_TYPES,
  isCompletedFromAudio,
  toNumber,
} from "@/lib/journeyProgress";
import { JOURNEY_LEVEL_IDS } from "@/lib/journeyUnlock";
import { getUserPushTarget } from "@/lib/pushRecipients";

/** Tipo de notificación bajo el que se filtra el opt-in del usuario. */
export const NEXT_STORY_NOTIFICATION_KEY = "new_content" as const;
/** Evento que marca "a este usuario ya se le anunció esta historia". */
export const NEXT_STORY_SENT_EVENT = "next_story_push_sent";

export const NEXT_STORY_MIN_HOURS = 20;
export const NEXT_STORY_MAX_HOURS = 120;
/** Horas que tienen que pasar entre dos avisos de este tipo al mismo usuario. */
export const NEXT_STORY_COOLDOWN_HOURS = 72;
/**
 * Cuánto hacia atrás se miran los finales. La ventana de envío son 120 horas;
 * mirar 21 días permite que el informe en seco enseñe a quién se le pasó el
 * arroz (`too_late`) en vez de devolver una lista vacía sin explicación.
 */
const LOOKBACK_DAYS = 21;

export type NextStorySkipReason =
  | "not_journey_story"
  | "journey_finished"
  | "too_soon"
  | "too_late"
  | "opened_next"
  | "already_sent"
  | "cooldown"
  | "opted_out"
  | "no_ios_token";

export type NextStoryCandidate = {
  userId: string;
  /** La que acaba de terminar. */
  fromSlug: string;
  fromTitle: string | null;
  /** La que se le anuncia. */
  toSlug: string | null;
  toTitle: string | null;
  journeyId: string | null;
  journeyLabel: string | null;
  language: string | null;
  /** Etiqueta en inglés del tema de la historia destino. */
  topicLabel: string | null;
  /** true cuando la siguiente abre un tema nuevo. */
  newTopic: boolean;
  /** Historias que quedan en ese tema, contando la destino. */
  leftInTopic: number;
  completedAt: Date;
  hoursSince: number;
  eligible: boolean;
  skip: NextStorySkipReason | null;
  tokenCount: number;
  androidOnly: boolean;
  title: string;
  body: string;
};

export type NextStoryRunReport = {
  now: string;
  dryRun: boolean;
  apnsConfigured: boolean;
  /** Finales mirados antes de filtrar nada. */
  rows: number;
  candidates: NextStoryCandidate[];
  sent: Array<{ userId: string; toSlug: string; delivered: number; failed: number }>;
  errors: string[];
};

/**
 * Copy del aviso. En inglés, como el resto de la interfaz del móvil, y hablando
 * del contenido que espera, nunca de lo que el alumno dejó de hacer (regla de
 * voz en `smartNotificationPlan.ts`).
 *
 * El gancho es el TÍTULO de la historia siguiente, en el idioma que se aprende:
 * están escritos para intrigar ("Humo en la cocina", "Convencer a mamá") y son
 * lo único concreto que se puede citar sin destripar la trama. La sinopsis, que
 * era el gancho previsto en el plan, no sirve: está en el idioma de la historia
 * y cuenta el final ("el perro se queda, con condiciones").
 */
export function nextStoryCopy(args: {
  toTitle: string | null;
  topicLabel: string | null;
  newTopic: boolean;
  leftInTopic: number;
  /** Posición de la historia destino en el journey, empezando en 1. */
  position: number;
  /** Posición del tema de la historia destino dentro del journey, desde 0. */
  topicIndex: number;
}): { title: string; body: string } {
  const name = (args.toTitle ?? "").trim();
  const topic = (args.topicLabel ?? "").trim();
  // Un alumno que llegue al final del journey recibe hasta veinte de estos.
  // Con una sola plantilla, del tercero en adelante ya no se leen: el ojo
  // reconoce la forma y salta. Las variantes rotan con la POSICIÓN de la
  // historia, así que son estables (la misma historia da siempre el mismo
  // texto, y se puede probar) y a la vez ninguna se repite seguida.
  const v = Math.max(0, args.position - 1);
  const title = name ? (v % 2 === 0 ? `${name} is next` : name) : "The next story is ready";

  if (!topic) {
    return { title, body: "One more waiting in your journey." };
  }

  const count = (n: number) => (n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : String(n));
  const up = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  // La forma rota con el TEMA, no con la posición. Los tres casos (abre tema,
  // quedan dos, queda una) ya se repiten cada tres historias, así que rotar por
  // posición los dejaba en fase: cada caso caía siempre en la misma frase y la
  // variedad no existía. Por tema, las tres historias de un tema suenan
  // distintas entre sí (son casos distintos) y el tema siguiente cambia el
  // molde.
  const form = Math.max(0, args.topicIndex) % 3;

  if (args.newTopic) {
    const bodies = [
      `${topic} opens with this one.`,
      `A new thread starts: ${topic}.`,
      `First of ${count(args.leftInTopic)} in ${topic}.`,
    ];
    return { title, body: bodies[form] };
  }
  // Contar lo que queda del tema es el único detalle concreto y verdadero que
  // hay a mano, y dice cuánto falta sin sonar a deuda.
  if (args.leftInTopic <= 1) {
    const bodies = [
      `The last one in ${topic}.`,
      `${topic} closes with this one.`,
      `One story left in ${topic}.`,
    ];
    return { title, body: bodies[form] };
  }
  const many = count(args.leftInTopic);
  const bodies = [
    `The ${topic} thread has ${many} stories left.`,
    `${up(many)} more in ${topic}, starting here.`,
    `${topic}: ${many} to go.`,
  ];
  return { title, body: bodies[form] };
}

/** Qué lugar ocupa ese tema en el orden de lectura del journey, desde 0. */
export function topicOrderIndex(journey: { stories: Array<{ topic: string }> }, topic: string): number {
  const seen: string[] = [];
  for (const story of journey.stories) {
    if (!seen.includes(story.topic)) seen.push(story.topic);
  }
  const i = seen.indexOf(topic);
  return i < 0 ? 0 : i;
}

type OrderedStory = {
  slug: string;
  title: string;
  topic: string;
  level: string;
  slotIndex: number;
};

type JourneyOrder = {
  id: string;
  label: string;
  language: string | null;
  stories: OrderedStory[];
};

function journeyLabel(journey: { name: string; levels: string[] }): string {
  const level = (journey.levels ?? [])[0];
  return level ? `${journey.name} ${level.toUpperCase()}` : journey.name;
}

function languageLabel(language: string | null | undefined): string | null {
  const raw = (language ?? "").trim();
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * Orden de lectura de cada journey publicado: nivel en orden CEFR, luego el
 * orden de temas que el Studio guardó en `Journey.topics[]`, luego `slotIndex`.
 * Es exactamente el orden con el que `journeyData` pinta la pestaña Journey; si
 * se calculara de otra forma, el aviso anunciaría una historia distinta de la
 * que el alumno ve en la siguiente tarjeta.
 */
export async function getJourneyOrders(): Promise<Map<string, JourneyOrder>> {
  const journeys = await prisma.journey.findMany({
    where: { status: "active" },
    select: {
      id: true,
      name: true,
      levels: true,
      language: true,
      topics: true,
      stories: {
        where: { status: "published", slug: { not: null }, title: { not: null } },
        select: { slug: true, title: true, topic: true, level: true, slotIndex: true },
      },
    },
  });

  const out = new Map<string, JourneyOrder>();
  for (const journey of journeys) {
    const topicOrder = (journey.topics ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const rankOfTopic = (topic: string) => {
      const i = topicOrder.indexOf(topic.trim().toLowerCase());
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const rankOfLevel = (level: string) => {
      const i = (JOURNEY_LEVEL_IDS as readonly string[]).indexOf(level.trim().toLowerCase());
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };

    const stories: OrderedStory[] = journey.stories
      .filter((s): s is typeof s & { slug: string; title: string } => Boolean(s.slug && s.title))
      .map((s) => ({ slug: s.slug, title: s.title, topic: s.topic, level: s.level, slotIndex: s.slotIndex }))
      .sort((a, b) => {
        const byLevel = rankOfLevel(a.level) - rankOfLevel(b.level);
        if (byLevel !== 0) return byLevel;
        const byTopic = rankOfTopic(a.topic) - rankOfTopic(b.topic);
        if (byTopic !== 0) return byTopic;
        if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
        return a.slotIndex - b.slotIndex;
      });

    if (stories.length === 0) continue;
    out.set(journey.id, {
      id: journey.id,
      label: journeyLabel(journey),
      language: languageLabel(journey.language),
      stories,
    });
  }
  return out;
}

/** Etiqueta canónica de cada tema, la misma que enseña la app. */
async function getTopicLabels(): Promise<Map<string, string>> {
  const rows = await prisma.topic.findMany({ select: { slug: true, label: true } });
  const out = new Map<string, string>();
  for (const row of rows) {
    if (row.slug && row.label) out.set(row.slug.toLowerCase(), row.label);
  }
  return out;
}

/**
 * Último final de cada usuario dentro de la ventana de búsqueda, con la misma
 * regla de "terminada" que el puente.
 */
async function getLatestCompletions(now: Date): Promise<Map<string, { storySlug: string; at: Date }>> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3_600_000);
  const rows = await prisma.userMetric.findMany({
    where: {
      eventType: { in: [...JOURNEY_COMPLETION_EVENT_TYPES] },
      createdAt: { gte: since },
      // `storySlug` no es nulable en la tabla, pero sí llega vacío en eventos
      // que no cuelgan de una historia; sin este filtro entran como falsos
      // finales de un slug que no existe.
      storySlug: { not: "" },
    },
    select: { userId: true, storySlug: true, eventType: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const out = new Map<string, { storySlug: string; at: Date }>();
  for (const row of rows) {
    if (!row.storySlug) continue;
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const complete =
      row.eventType === "audio_complete" ||
      (metadata !== null &&
        isCompletedFromAudio(toNumber(metadata.progressSec), toNumber(metadata.audioDurationSec)));
    if (!complete) continue;
    // Las filas vienen en orden ascendente, así que la última que se escribe
    // por usuario es la más reciente.
    out.set(row.userId, { storySlug: row.storySlug, at: row.createdAt });
  }
  return out;
}

/** Pares usuario+slug que ya recibieron este aviso alguna vez. */
async function alreadySentKeys(pairs: Array<{ userId: string; toSlug: string }>): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();
  const rows = await prisma.userMetric.findMany({
    where: {
      eventType: NEXT_STORY_SENT_EVENT,
      userId: { in: [...new Set(pairs.map((p) => p.userId))] },
      storySlug: { in: [...new Set(pairs.map((p) => p.toSlug))] },
    },
    select: { userId: true, storySlug: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${r.storySlug}`));
}

/** Usuarios que recibieron un aviso de este tipo dentro del periodo de espera. */
async function inCooldown(userIds: string[], now: Date): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const since = new Date(now.getTime() - NEXT_STORY_COOLDOWN_HOURS * 3_600_000);
  const rows = await prisma.userMetric.findMany({
    where: { eventType: NEXT_STORY_SENT_EVENT, userId: { in: userIds }, createdAt: { gte: since } },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

/** Pares usuario+slug donde el alumno ya tocó la historia destino por su cuenta. */
async function openedKeys(pairs: Array<{ userId: string; toSlug: string }>): Promise<Set<string>> {
  if (pairs.length === 0) return new Set();
  const rows = await prisma.userMetric.findMany({
    where: {
      userId: { in: [...new Set(pairs.map((p) => p.userId))] },
      storySlug: { in: [...new Set(pairs.map((p) => p.toSlug))] },
      eventType: { not: NEXT_STORY_SENT_EVENT },
    },
    select: { userId: true, storySlug: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${r.storySlug}`));
}

/**
 * Calcula candidatos y, si `dryRun` es false Y el interruptor de entorno está
 * encendido, manda el aviso. Por defecto NO manda: es una acción hacia fuera y
 * el valor por defecto seguro es contar, no escribir a nadie.
 */
export async function runNextStoryPush(args?: { dryRun?: boolean; now?: Date }): Promise<NextStoryRunReport> {
  const now = args?.now ?? new Date();
  const enabled = /^(1|true|yes)$/i.test(process.env.NEXT_STORY_PUSH_ENABLED?.trim() ?? "");
  const dryRun = args?.dryRun ?? !enabled;

  const report: NextStoryRunReport = {
    now: now.toISOString(),
    dryRun,
    apnsConfigured: isApnsConfigured(),
    rows: 0,
    candidates: [],
    sent: [],
    errors: [],
  };

  const [completions, orders, topicLabels] = await Promise.all([
    getLatestCompletions(now),
    getJourneyOrders(),
    getTopicLabels(),
  ]);
  report.rows = completions.size;
  if (completions.size === 0) return report;

  // Índice slug -> journey + posición, para resolver de un salto la historia
  // que el alumno acaba de terminar.
  const positionOf = new Map<string, { journey: JourneyOrder; index: number }>();
  for (const journey of orders.values()) {
    journey.stories.forEach((story, index) => positionOf.set(story.slug, { journey, index }));
  }

  type Draft = { userId: string; from: string; at: Date; next: OrderedStory | null; journey: JourneyOrder | null };
  const drafts: Draft[] = [];
  for (const [userId, completion] of completions) {
    const at = positionOf.get(completion.storySlug) ?? null;
    drafts.push({
      userId,
      from: completion.storySlug,
      at: completion.at,
      next: at ? (at.journey.stories[at.index + 1] ?? null) : null,
      journey: at?.journey ?? null,
    });
  }

  const resolvable = drafts.filter((d) => d.next).map((d) => ({ userId: d.userId, toSlug: d.next!.slug }));
  const [sentAlready, cooldown, opened] = await Promise.all([
    alreadySentKeys(resolvable),
    inCooldown([...new Set(drafts.map((d) => d.userId))], now),
    openedKeys(resolvable),
  ]);

  for (const draft of drafts) {
    const hoursSince = (now.getTime() - draft.at.getTime()) / 3_600_000;
    const next = draft.next;
    const topicLabel = next ? (topicLabels.get(next.topic.toLowerCase()) ?? null) : null;
    const fromStory = draft.journey?.stories.find((s) => s.slug === draft.from) ?? null;
    const newTopic = Boolean(next && fromStory && next.topic !== fromStory.topic);
    // Mismo tema Y mismo nivel: un journey de varios niveles puede repetir el
    // tema, y contar los dos juntos anunciaría historias que el alumno no tiene
    // delante.
    const leftInTopic = next
      ? (draft.journey?.stories.filter(
          (s) => s.topic === next.topic && s.level === next.level && s.slotIndex >= next.slotIndex,
        ).length ?? 1)
      : 0;
    const position = next && draft.journey ? draft.journey.stories.findIndex((s) => s.slug === next.slug) + 1 : 1;
    const topicIndex = next && draft.journey ? topicOrderIndex(draft.journey, next.topic) : 0;
    const copy = nextStoryCopy({ toTitle: next?.title ?? null, topicLabel, newTopic, leftInTopic, position, topicIndex });
    const key = next ? `${draft.userId}:${next.slug}` : "";

    const candidate: NextStoryCandidate = {
      userId: draft.userId,
      fromSlug: draft.from,
      fromTitle: fromStory?.title ?? null,
      toSlug: next?.slug ?? null,
      toTitle: next?.title ?? null,
      journeyId: draft.journey?.id ?? null,
      journeyLabel: draft.journey?.label ?? null,
      language: draft.journey?.language ?? null,
      topicLabel,
      newTopic,
      leftInTopic,
      completedAt: draft.at,
      hoursSince: Math.round(hoursSince * 10) / 10,
      eligible: false,
      skip: null,
      tokenCount: 0,
      androidOnly: false,
      ...copy,
    };

    // La historia terminada no vive en ningún journey publicado: o es de
    // catálogo o su journey está en borrador. En los dos casos no hay
    // "siguiente" que el alumno pueda abrir.
    if (!draft.journey) candidate.skip = "not_journey_story";
    else if (!next) candidate.skip = "journey_finished";
    else if (hoursSince < NEXT_STORY_MIN_HOURS) candidate.skip = "too_soon";
    else if (hoursSince > NEXT_STORY_MAX_HOURS) candidate.skip = "too_late";
    else if (opened.has(key)) candidate.skip = "opened_next";
    else if (sentAlready.has(key)) candidate.skip = "already_sent";
    else if (cooldown.has(draft.userId)) candidate.skip = "cooldown";

    if (!candidate.skip) {
      try {
        const target = await getUserPushTarget(draft.userId, NEXT_STORY_NOTIFICATION_KEY);
        candidate.tokenCount = target.tokens.length;
        candidate.androidOnly = target.androidOnly;
        if (!target.optedIn) candidate.skip = "opted_out";
        else if (target.tokens.length === 0) candidate.skip = "no_ios_token";
        else candidate.eligible = true;
      } catch (err) {
        report.errors.push(`clerk ${draft.userId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    report.candidates.push(candidate);
    if (!candidate.eligible || dryRun || !next || !draft.journey) continue;

    if (!report.apnsConfigured) {
      report.errors.push("APNs sin configurar; no se manda nada.");
      continue;
    }

    try {
      const target = await getUserPushTarget(draft.userId, NEXT_STORY_NOTIFICATION_KEY);
      const results = await sendApnsPush(target.tokens, {
        title: candidate.title,
        body: candidate.body,
        // `language` viaja porque la app tiene que cambiar de idioma antes de
        // poder seleccionar el track; sin él, tocar el aviso desde otro idioma
        // no encuentra el journey.
        data: {
          notificationType: NEXT_STORY_NOTIFICATION_KEY,
          trigger: "next_story",
          journeyId: draft.journey.id,
          language: draft.journey.language ?? undefined,
          storySlug: next.slug,
        },
      });
      const delivered = results.filter((r) => r.ok).length;
      // El sello va aunque falle la entrega: reintentar contra un token muerto
      // no lo resucita y sí duplica el aviso el día que reinstale.
      await prisma.userMetric.create({
        data: {
          userId: draft.userId,
          storySlug: next.slug,
          eventType: NEXT_STORY_SENT_EVENT,
          value: delivered,
          metadata: {
            journeyId: draft.journey.id,
            fromSlug: draft.from,
            hoursSince: candidate.hoursSince,
            newTopic: candidate.newTopic,
          },
        },
      });
      report.sent.push({ userId: draft.userId, toSlug: next.slug, delivered, failed: results.length - delivered });
    } catch (err) {
      report.errors.push(`apns ${draft.userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

/**
 * Envío de PRUEBA a un solo usuario, con el texto real del aviso. No mira la
 * ventana, no mira si terminó nada y NO deja el sello de "ya avisado", así que
 * se puede repetir. Existe para juzgar el texto en un teléfono propio antes de
 * encender el interruptor; el cron nunca llama a esto.
 */
export async function sendNextStoryTest(args: {
  userId: string;
  storySlug?: string;
}): Promise<{ ok: boolean; title?: string; body?: string; delivered?: number; failed?: number; error?: string }> {
  if (!isApnsConfigured()) return { ok: false, error: "APNs sin configurar" };

  const [orders, topicLabels] = await Promise.all([getJourneyOrders(), getTopicLabels()]);
  let journey: JourneyOrder | null = null;
  let index = -1;

  if (args.storySlug) {
    for (const candidate of orders.values()) {
      const i = candidate.stories.findIndex((s) => s.slug === args.storySlug);
      if (i >= 0) {
        journey = candidate;
        index = i;
        break;
      }
    }
    if (!journey) return { ok: false, error: `El slug ${args.storySlug} no está en ningún journey publicado` };
  } else {
    // Sin slug: la primera pareja que exista, solo para poder leer el texto.
    journey = [...orders.values()].find((j) => j.stories.length > 1) ?? null;
    index = 0;
  }
  const next = journey ? journey.stories[index + 1] : null;
  if (!journey || !next) return { ok: false, error: "No hay historia siguiente que anunciar" };

  const from = journey.stories[index];
  const leftInTopic = journey.stories.filter(
    (s) => s.topic === next.topic && s.level === next.level && s.slotIndex >= next.slotIndex,
  ).length;
  const copy = nextStoryCopy({
    toTitle: next.title,
    topicLabel: topicLabels.get(next.topic.toLowerCase()) ?? null,
    newTopic: next.topic !== from.topic,
    leftInTopic,
    position: index + 2,
    topicIndex: topicOrderIndex(journey, next.topic),
  });

  const target = await getUserPushTarget(args.userId, NEXT_STORY_NOTIFICATION_KEY);
  if (!target.optedIn) return { ok: false, error: `El usuario tiene ${NEXT_STORY_NOTIFICATION_KEY} desactivado`, ...copy };
  if (target.tokens.length === 0) {
    return {
      ok: false,
      error: target.androidOnly ? "Solo hay token de Android y no hay emisor FCM" : "Sin token de iOS registrado",
      ...copy,
    };
  }

  const results = await sendApnsPush(target.tokens, {
    title: copy.title,
    body: copy.body,
    data: {
      notificationType: NEXT_STORY_NOTIFICATION_KEY,
      trigger: "next_story",
      journeyId: journey.id,
      language: journey.language ?? undefined,
      storySlug: next.slug,
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
