/**
 * Quien es el tester que escribio y que estaba haciendo cuando escribio.
 *
 * Un mensaje de feedback no se puede triar solo: "las mismas historias
 * volvian" no dice nada hasta ver que ese tester es principiante, que abrio
 * dos historias C1 y que nunca termino un audio. Las tres cosas viven en tres
 * tablas (`BetaFeedback`, `BetaSignup`, `UserMetric`), y este modulo las junta
 * una sola vez para que la pestana Feedback del Studio y
 * `scripts/feedbackTable.ts` cuenten exactamente lo mismo. Antes solo lo
 * calculaba el script, y para saber que historia leia un tester al quejarse
 * habia que cruzar UserMetric a mano.
 *
 * Sin `server-only` a proposito: el script lo importa por ruta relativa desde
 * `scripts/`, fuera del bundler de Next. El cliente Prisma llega por parametro
 * por lo mismo (el script tiene el suyo y lo desconecta al acabar).
 */

/** Eventos que cuentan como "termino el audio" (misma regla que journeyProgress). */
export const AUDIO_DONE = ["audio_complete", "continue_listening_progress"];

export type MetricRow = {
  userId: string;
  eventType: string;
  storySlug: string | null;
  createdAt: Date;
};

export type StoryRef = {
  slug: string;
  title: string | null;
  /** `Traveler latam A0`: tipo, variante y nivel del journey, como en el script. */
  journey: string | null;
  level: string | null;
};

export type TesterUsage = {
  opened: number;
  audiosDone: number;
  practices: number;
  /** Las tres ultimas historias distintas abiertas, en orden de apertura. */
  last: StoryRef[];
};

/** Donde estaba el tester cuando escribio, y de donde lo sabemos. */
export type FeedbackWhere = StoryRef & {
  /** `context`: la app lo mando con el feedback. `metric`: ultima historia
   *  abierta en UserMetric antes de escribir. */
  source: "context" | "metric";
  /** Solo para `metric`: cuando la abrio. */
  at: Date | null;
};

type PrismaLike = {
  journeyStory: {
    findMany(args: {
      select: {
        slug: true;
        title: true;
        journey: { select: { name: true; variant: true; levels: true } };
      };
    }): Promise<
      Array<{
        slug: string | null;
        title: string | null;
        journey: { name: string; variant: string; levels: string[] };
      }>
    >;
  };
  userMetric: {
    findMany(args: {
      where: { userId: { in: string[] } };
      select: { userId: true; eventType: true; storySlug: true; createdAt: true };
      orderBy: { createdAt: "asc" };
    }): Promise<MetricRow[]>;
  };
};

/**
 * Slug de historia -> journey (tipo, variante, nivel) y titulo. Es la pieza que
 * convierte "abrio tal historia" en "estaba leyendo un C1".
 */
export async function loadStoryIndex(prisma: PrismaLike): Promise<Map<string, StoryRef>> {
  const index = new Map<string, StoryRef>();
  const stories = await prisma.journeyStory.findMany({
    select: { slug: true, title: true, journey: { select: { name: true, variant: true, levels: true } } },
  });
  for (const story of stories) {
    if (!story.slug) continue;
    const level = (story.journey.levels ?? []).join("/").toUpperCase();
    index.set(story.slug, {
      slug: story.slug,
      title: story.title,
      journey: `${story.journey.name} ${story.journey.variant} ${level}`,
      level: level || null,
    });
  }
  return index;
}

/** Todos los eventos de esos usuarios, en orden cronologico. */
export async function loadMetrics(prisma: PrismaLike, userIds: string[]): Promise<MetricRow[]> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return [];
  return prisma.userMetric.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, eventType: true, storySlug: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

function refFor(slug: string, index: Map<string, StoryRef>): StoryRef {
  return index.get(slug) ?? { slug, title: null, journey: null, level: null };
}

/** Lo que la telemetria dice que hizo de verdad un usuario. */
export function usageFor(metrics: MetricRow[], userId: string, index: Map<string, StoryRef>): TesterUsage {
  const mine = metrics.filter((metric) => metric.userId === userId);
  const opened = mine.filter((metric) => metric.eventType === "story_opened");
  const audios = mine.filter((metric) => AUDIO_DONE.includes(metric.eventType));
  const practices = mine.filter((metric) => metric.eventType === "practice_session_completed");
  const last = Array.from(new Set(opened.map((metric) => metric.storySlug ?? "?")))
    .slice(-3)
    .map((slug) => refFor(slug, index));
  return { opened: opened.length, audiosDone: audios.length, practices: practices.length, last };
}

/** La misma frase que imprimia `scripts/feedbackTable.ts` en "Que hizo de verdad". */
export function formatUsage(usage: TesterUsage): string {
  const last = usage.last.map((ref) => `${ref.slug}${ref.journey ? ` (${ref.journey})` : ""}`);
  return [
    `${usage.opened} abiertas`,
    `${usage.audiosDone} audios terminados`,
    `${usage.practices} prácticas`,
    last.length ? `últimas: ${last.join("; ")}` : "sin lecturas",
  ].join(" · ");
}

/**
 * Donde estaba el tester cuando escribio. Primero lo que la app mando en
 * `context` (hoy la app movil solo manda `screen`, asi que casi siempre llega
 * null); si no, la ultima historia abierta en UserMetric antes de escribir.
 */
export function whereFor(
  context: unknown,
  metrics: MetricRow[],
  userId: string | null,
  createdAt: Date,
  index: Map<string, StoryRef>
): FeedbackWhere | null {
  const slugFromContext = storySlugFromContext(context);
  if (slugFromContext) {
    return { ...refFor(slugFromContext, index), source: "context", at: null };
  }
  if (!userId) return null;
  let lastOpened: MetricRow | null = null;
  for (const metric of metrics) {
    if (metric.userId !== userId || metric.eventType !== "story_opened" || !metric.storySlug) continue;
    if (metric.createdAt > createdAt) break;
    lastOpened = metric;
  }
  if (!lastOpened?.storySlug) return null;
  return { ...refFor(lastOpened.storySlug, index), source: "metric", at: lastOpened.createdAt };
}

/** El `context` es JSON libre; se aceptan las claves razonables para un slug. */
function storySlugFromContext(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const record = context as Record<string, unknown>;
  for (const key of ["storySlug", "slug", "story"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
