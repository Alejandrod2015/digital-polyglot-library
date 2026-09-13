// Los pulgares y sus comentarios, para la pestaña Engagement de /studio/metrics.
//
// Dos cosas que hacen falta para que la cifra no mienta, y que ya se rompieron
// en informes a mano:
//
// 1. Lo de casa fuera, con TODAS las redes a la vez. El `userScope` del panel
//    quita a los internos que resuelve Clerk y aplica la cohorte; encima va el
//    sello `internal` que el endpoint pone al escribir, y `splitInternal`, que
//    es el unico que conoce el dominio @digitalpolyglot.com. El 2026-09-05 los
//    dos unicos pulgares "de testers" eran de review@, que no esta en el Studio.
//
// 2. La conversion sobre preguntas, no sobre filas. Una pregunta es
//    `(persona, cosa, superficie)`, la misma clave unica que tiene el voto:
//    cinco impresiones seguidas del panel de favoritos son una sola pregunta.
//    Una pregunta cuenta si al menos una de sus impresiones llego sin voto
//    previo: tras votar, la fila vuelve a salir marcada `alreadyRated`, y
//    descartar la pregunta por eso saca del denominador justo las contestadas.
//    Un voto sin impresion en el rango no entra en la conversion; se cuenta
//    aparte, o el porcentaje sale por encima de lo real.

import { prisma } from "@/lib/prisma";
import { splitInternal } from "@/lib/internalAccounts";
import { resolveUserEmails } from "@/lib/metricsUserEmails";
import type { MetricsUserScope } from "@/lib/metricsCohort";

const BY_STORY_LIMIT = 30;
const COMMENTS_LIMIT = 50;

export type RatingsMetrics = {
  up: number;
  down: number;
  voters: number;
  comments: number;
  /** Votos e impresiones del equipo que se han quitado, para decirlo y no esconderlo. */
  excludedInternalVotes: number;
  excludedInternalPrompts: number;
  bySurface: Array<{
    surface: string;
    up: number;
    down: number;
    /** Preguntas `(persona, cosa, superficie)` mostradas sin voto previo. */
    asked: number;
    /** De esas preguntas, cuantas tienen voto. */
    answered: number;
  }>;
  /** Votos cuya pregunta no dejo impresion en el rango. Fuera de la conversion. */
  votesWithoutView: number;
  byStory: Array<{
    storySlug: string;
    surface: string;
    up: number;
    down: number;
    comments: number;
    lastAt: string;
  }>;
  /** Una fila por persona de fuera que vio la pregunta o voto. */
  byPerson: Array<{
    userId: string;
    /** null: ni nuestras tablas ni Clerk saben quien es; no se puede descartar que sea de casa. */
    email: string | null;
    platforms: string[];
    story: { asked: number; answered: number };
    practice: { asked: number; answered: number };
    up: number;
    down: number;
    comments: number;
  }>;
  commentRows: Array<{
    createdAt: string;
    email: string | null;
    surface: string;
    storySlug: string;
    liked: boolean;
    comment: string;
    platform: string | null;
  }>;
};

export function emptyRatingsMetrics(): RatingsMetrics {
  return {
    up: 0,
    down: 0,
    voters: 0,
    comments: 0,
    excludedInternalVotes: 0,
    excludedInternalPrompts: 0,
    bySurface: [],
    votesWithoutView: 0,
    byStory: [],
    byPerson: [],
    commentRows: [],
  };
}

type PromptMeta = { surface?: unknown; internal?: unknown; alreadyRated?: unknown };

const surfaceOf = (s: string | null | undefined) => (s === "practice" ? "practice" : "story");
const keyOf = (userId: string, slug: string, surface: string) => `${userId}::${slug}::${surface}`;

export async function computeRatingsMetrics(args: {
  userScope: MetricsUserScope;
  from: Date;
  to: Date;
  storySlug?: string | null;
  bookSlug?: string | null;
}): Promise<RatingsMetrics> {
  const { userScope, from, to, storySlug, bookSlug } = args;
  const slugFilter = {
    ...(storySlug ? { storySlug } : {}),
    ...(bookSlug ? { bookSlug } : {}),
  };

  const [ratingRows, promptRows] = await Promise.all([
    prisma.storyRating.findMany({
      where: { ...userScope, createdAt: { gte: from, lte: to }, ...slugFilter },
      select: {
        userId: true,
        email: true,
        storySlug: true,
        surface: true,
        liked: true,
        comment: true,
        internal: true,
        platform: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userMetric.findMany({
      where: {
        ...userScope,
        eventType: "rating_prompt_shown",
        createdAt: { gte: from, lte: to },
        ...slugFilter,
      },
      select: { userId: true, storySlug: true, metadata: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // UserMetric no guarda correo, y sin correo el dominio de la empresa no se
  // puede reconocer: una cuenta de casa pasaria por tester. Primero las tablas
  // nuestras que guardan id y correo juntos, que responden igual en local que
  // en produccion; Clerk solo para lo que quede.
  const emailOf = new Map<string, string>();
  for (const r of ratingRows) if (r.email) emailOf.set(r.userId, r.email);
  const faltan = () =>
    Array.from(new Set([...ratingRows, ...promptRows].map((r) => r.userId))).filter(
      (id) => !emailOf.has(id),
    );
  if (faltan().length > 0) {
    const ids = faltan();
    const [signups, prefs] = await Promise.all([
      prisma.betaSignup.findMany({
        where: { clerkUserId: { in: ids } },
        select: { clerkUserId: true, email: true },
      }),
      prisma.emailPreference.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, email: true },
      }),
    ]);
    for (const e of prefs) if (e.userId) emailOf.set(e.userId, e.email);
    for (const b of signups) if (b.clerkUserId) emailOf.set(b.clerkUserId, b.email);
  }
  if (faltan().length > 0) {
    const resueltos = await resolveUserEmails(faltan());
    for (const [id, email] of resueltos) if (email) emailOf.set(id, email);
  }
  const correo = (userId: string, own?: string | null) => own ?? emailOf.get(userId) ?? null;

  const { external: votes, internal: votosCasaPorCorreo } = await splitInternal(
    ratingRows.filter((r) => !r.internal),
    (r) => correo(r.userId, r.email),
  );
  const excludedInternalVotes =
    ratingRows.filter((r) => r.internal).length + votosCasaPorCorreo.length;

  const meta = (m: unknown): PromptMeta => (m && typeof m === "object" ? (m as PromptMeta) : {});
  const { external: prompts, internal: promptsCasaPorCorreo } = await splitInternal(
    promptRows.filter((r) => meta(r.metadata).internal !== true),
    (r) => correo(r.userId),
  );
  const excludedInternalPrompts =
    promptRows.filter((r) => meta(r.metadata).internal === true).length +
    promptsCasaPorCorreo.length;

  // Preguntas: con al menos una impresion que no llegaba ya votada.
  const vistas = new Set<string>();
  const preguntas = new Map<string, string>();
  for (const p of prompts) {
    const m = meta(p.metadata);
    const surface = surfaceOf(typeof m.surface === "string" ? m.surface : null);
    const k = keyOf(p.userId, p.storySlug, surface);
    vistas.add(k);
    if (m.alreadyRated !== true) preguntas.set(k, surface);
  }

  const votadas = new Set<string>();
  let votesWithoutView = 0;
  for (const v of votes) {
    const k = keyOf(v.userId, v.storySlug, surfaceOf(v.surface));
    votadas.add(k);
    if (!vistas.has(k)) votesWithoutView += 1;
  }

  const bySurface = (["story", "practice"] as const)
    .map((surface) => {
      const deEsta = votes.filter((v) => surfaceOf(v.surface) === surface);
      const keys = [...preguntas].filter(([, s]) => s === surface).map(([k]) => k);
      return {
        surface,
        up: deEsta.filter((v) => v.liked).length,
        down: deEsta.filter((v) => !v.liked).length,
        asked: keys.length,
        answered: keys.filter((k) => votadas.has(k)).length,
      };
    })
    .filter((s) => s.up + s.down + s.asked > 0);

  const porHistoria = new Map<string, RatingsMetrics["byStory"][number]>();
  for (const v of votes) {
    const surface = surfaceOf(v.surface);
    const k = `${v.storySlug}::${surface}`;
    const fila = porHistoria.get(k) ?? {
      storySlug: v.storySlug,
      surface,
      up: 0,
      down: 0,
      comments: 0,
      lastAt: v.createdAt.toISOString(),
    };
    if (v.liked) fila.up += 1;
    else fila.down += 1;
    if (v.comment?.trim()) fila.comments += 1;
    porHistoria.set(k, fila);
  }
  const byStory = [...porHistoria.values()]
    .sort((a, b) => b.up + b.down - (a.up + a.down) || b.lastAt.localeCompare(a.lastAt))
    .slice(0, BY_STORY_LIMIT);

  const personas = new Map<string, RatingsMetrics["byPerson"][number]>();
  const persona = (userId: string) => {
    let fila = personas.get(userId);
    if (!fila) {
      fila = {
        userId,
        email: correo(userId),
        platforms: [],
        story: { asked: 0, answered: 0 },
        practice: { asked: 0, answered: 0 },
        up: 0,
        down: 0,
        comments: 0,
      };
      personas.set(userId, fila);
    }
    return fila;
  };
  const anotaSistema = (userId: string, platform: unknown) => {
    const fila = persona(userId);
    if (typeof platform === "string" && platform && !fila.platforms.includes(platform)) {
      fila.platforms.push(platform);
    }
  };
  for (const p of prompts) anotaSistema(p.userId, (p.metadata as { platform?: unknown } | null)?.platform);
  for (const [k, surface] of preguntas) {
    const userId = k.split("::")[0];
    const celdaSup = surface === "practice" ? persona(userId).practice : persona(userId).story;
    celdaSup.asked += 1;
    if (votadas.has(k)) celdaSup.answered += 1;
  }
  for (const v of votes) {
    anotaSistema(v.userId, v.platform);
    const fila = persona(v.userId);
    if (v.liked) fila.up += 1;
    else fila.down += 1;
    if (v.comment?.trim()) fila.comments += 1;
  }
  const byPerson = [...personas.values()].sort(
    (a, b) =>
      b.up + b.down - (a.up + a.down) ||
      b.story.asked + b.practice.asked - (a.story.asked + a.practice.asked),
  );

  const conComentario = votes.filter((v) => v.comment?.trim());
  const commentRows = conComentario.slice(0, COMMENTS_LIMIT).map((v) => ({
    createdAt: v.createdAt.toISOString(),
    email: correo(v.userId, v.email),
    surface: surfaceOf(v.surface),
    storySlug: v.storySlug,
    liked: v.liked,
    comment: (v.comment ?? "").trim(),
    platform: v.platform,
  }));

  return {
    up: votes.filter((v) => v.liked).length,
    down: votes.filter((v) => !v.liked).length,
    voters: new Set(votes.map((v) => v.userId)).size,
    comments: conComentario.length,
    excludedInternalVotes,
    excludedInternalPrompts,
    bySurface,
    votesWithoutView,
    byStory,
    byPerson,
    commentRows,
  };
}
