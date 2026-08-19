export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMetricsAccessAllowed } from "@/lib/metricsAccess";

/**
 * Studio · Métricas → ficha de un usuario.
 *
 * Devuelve TODO lo medible de una sola persona: identidad y plan, sesiones
 * derivadas de sus eventos, escucha por historia, práctica, vocabulario,
 * journeys, notificaciones, monetización, onboarding y un timeline crudo.
 *
 * Read-only. Mismo gate que el resto de /api/metrics/*.
 *
 * Convenciones que se comparten con /api/metrics/dashboard para que los
 * números cuadren entre pantallas:
 *   - "minutos escuchados" = suma del MÁXIMO progreso alcanzado por historia
 *     (no la suma de eventos, que sobrecuenta las repeticiones).
 *   - "sesión" = racha de eventos con menos de 30 min de hueco entre ellos.
 */

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const CACHE_TTL_MS = 60 * 1000;
const SESSION_GAP_MS = 30 * 60 * 1000;
const MAX_EVENTS = 30000;
const DAILY_WINDOW_DAYS = 90;
const TIMELINE_LIMIT = 60;

const cache = new Map<string, { at: number; payload: unknown }>();

type Meta = Record<string, unknown>;

type EventRow = {
  eventType: string;
  storySlug: string;
  bookSlug: string | null;
  value: number | null;
  metadata: unknown;
  createdAt: Date;
};

function meta(row: { metadata: unknown }): Meta {
  return row.metadata && typeof row.metadata === "object"
    ? (row.metadata as Meta)
    : {};
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeLanguageCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("es") || v === "spanish" || v === "castellano") return "es";
  if (v.startsWith("it") || v === "italian" || v === "italiano") return "it";
  if (v.startsWith("de") || v === "german" || v === "deutsch") return "de";
  if (v.startsWith("fr") || v === "french" || v.startsWith("français")) return "fr";
  if (v.startsWith("pt") || v === "portuguese" || v === "português") return "pt";
  if (v.startsWith("en") || v === "english") return "en";
  return v.slice(0, 2);
}

/** Slugs sintéticos que la app usa como "canal" y no son historias reales. */
const PSEUDO_SLUGS = new Set([
  "journey",
  "onboarding",
  "practice",
  "daily-loop",
  "__plans__",
  "__auth__",
  "__checkout__",
]);

function isRealStory(slug: string): boolean {
  return !!slug && !PSEUDO_SLUGS.has(slug);
}

/** Último recurso: convierte `el-baul-de-la-abuela` en `El baul de la abuela`. */
function humanizeSlug(slug: string): string {
  const clean = slug.replace(/-[a-z0-9]{6}$/i, "").replace(/-/g, " ").trim();
  if (!clean) return slug;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

type StoryInfo = { title: string; language: string | null; resolved: boolean };

/**
 * slug -> título + idioma. Cuatro fuentes, en orden de autoridad:
 * CatalogStory, JourneyStory (idioma desde su Journey), StandaloneStory y
 * UserStory. Lo que no aparezca en ninguna se humaniza desde el slug y se
 * marca `resolved: false` para que la UI lo muestre como slug crudo.
 */
async function resolveStories(slugs: string[]): Promise<Map<string, StoryInfo>> {
  const out = new Map<string, StoryInfo>();
  if (slugs.length === 0) return out;

  const [catalog, journey, standalone, userStories, library] = await Promise.all([
    prisma.catalogStory.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, language: true, book: { select: { language: true } } },
    }),
    prisma.journeyStory.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, journey: { select: { language: true } } },
    }),
    prisma.standaloneStory.findMany({
      where: { OR: [{ slug: { in: slugs } }, { id: { in: slugs } }] },
      select: { id: true, slug: true, title: true, language: true },
    }),
    prisma.userStory.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, language: true },
    }),
    // LibraryStory guarda el título tal como lo vio el usuario al guardarlo;
    // rescata historias que ya no existen en ninguna tabla de contenido.
    prisma.libraryStory.findMany({
      where: { storyId: { in: slugs } },
      select: { storyId: true, title: true },
      distinct: ["storyId"],
    }),
  ]);

  const put = (slug: string | null, title: string | null, lang: string | null) => {
    if (!slug || !title || out.has(slug)) return;
    out.set(slug, {
      title,
      language: lang ? normalizeLanguageCode(lang) : null,
      resolved: true,
    });
  };

  for (const r of catalog) put(r.slug, r.title, r.language ?? r.book?.language ?? null);
  for (const r of journey) put(r.slug, r.title, r.journey?.language ?? null);
  for (const r of standalone) {
    put(r.slug, r.title, r.language);
    put(r.id, r.title, r.language);
  }
  for (const r of userStories) put(r.slug, r.title, r.language);
  for (const r of library) put(r.storyId, r.title, null);

  for (const slug of slugs) {
    if (!out.has(slug)) {
      out.set(slug, { title: humanizeSlug(slug), language: null, resolved: false });
    }
  }
  return out;
}

// ── sesiones ────────────────────────────────────────────────────
type Session = {
  startedAt: Date;
  endedAt: Date;
  events: number;
  stories: Set<string>;
};

function buildSessions(events: EventRow[]): Session[] {
  const sessions: Session[] = [];
  for (const e of events) {
    const last = sessions[sessions.length - 1];
    if (last && e.createdAt.getTime() - last.endedAt.getTime() <= SESSION_GAP_MS) {
      last.endedAt = e.createdAt;
      last.events += 1;
      if (isRealStory(e.storySlug)) last.stories.add(e.storySlug);
      continue;
    }
    sessions.push({
      startedAt: e.createdAt,
      endedAt: e.createdAt,
      events: 1,
      stories: new Set(isRealStory(e.storySlug) ? [e.storySlug] : []),
    });
  }
  return sessions;
}

function streaks(dayKeys: string[]): { current: number; longest: number } {
  if (dayKeys.length === 0) return { current: 0, longest: 0 };
  const sorted = Array.from(new Set(dayKeys)).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
    const curr = Date.parse(`${sorted[i]}T00:00:00Z`);
    if (curr - prev === 86400000) run += 1;
    else run = 1;
    if (run > longest) longest = run;
  }
  // La racha actual solo cuenta si el último día activo es hoy o ayer.
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const last = sorted[sorted.length - 1];
  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      const prev = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
      const curr = Date.parse(`${sorted[i]}T00:00:00Z`);
      if (curr - prev === 86400000) current += 1;
      else break;
    }
  }
  return { current, longest };
}

function topCounts<T extends string>(
  map: Map<T, number>,
  limit: number
): Array<{ key: T; count: number }> {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
): Promise<Response> {
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId).catch(() => null);
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses?.[0]?.emailAddress ??
      null;
    const clerkEmails = (clerkUser?.emailAddresses ?? [])
      .map((e) => e.emailAddress)
      .filter(Boolean);

    const [
      events,
      resumeRows,
      entitlement,
      favorites,
      favoriteCount,
      collectionCount,
      savedStories,
      savedBooks,
      betaSignup,
      betaFeedback,
      emailPref,
      userStoryCount,
    ] = await Promise.all([
      prisma.userMetric.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: MAX_EVENTS,
        select: {
          eventType: true,
          storySlug: true,
          bookSlug: true,
          value: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.continueListeningEntry.findMany({
        where: { userId },
        orderBy: { lastPlayedAt: "desc" },
        select: {
          storySlug: true,
          bookSlug: true,
          progressSec: true,
          audioDurationSec: true,
          lastPlayedAt: true,
        },
      }),
      prisma.billingEntitlement.findUnique({ where: { userId } }),
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          word: true,
          translation: true,
          wordType: true,
          language: true,
          storyTitle: true,
          createdAt: true,
          streak: true,
        },
      }),
      prisma.favorite.count({ where: { userId } }),
      prisma.favoriteCollection.count({ where: { userId } }),
      prisma.libraryStory.count({ where: { userId } }),
      prisma.libraryBook.count({ where: { userId } }),
      // Igual que en /api/metrics/acquisition: la solicitud puede estar
      // guardada bajo el email del Apple ID o de la cuenta de Google, que es
      // la que usó para instalar y con la que suele nacer la cuenta. Buscar
      // sólo por el email del formulario escondía beta testers.
      prisma.betaSignup.findFirst({
        where: {
          OR: [
            { clerkUserId: userId },
            ...(clerkEmails.length
              ? [
                  { email: { in: clerkEmails, mode: "insensitive" as const } },
                  { appleIdEmail: { in: clerkEmails, mode: "insensitive" as const } },
                  { googleEmail: { in: clerkEmails, mode: "insensitive" as const } },
                ]
              : []),
          ],
        },
      }),
      prisma.betaFeedback.findMany({
        where: email ? { OR: [{ userId }, { email }] } : { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { kind: true, rating: true, message: true, createdAt: true, status: true },
      }),
      email
        ? prisma.emailPreference.findUnique({ where: { email } })
        : Promise.resolve(null),
      prisma.userStory.count({ where: { userId } }),
    ]);

    const rows = events as EventRow[];

    // ── índices por tipo de evento ──
    const byType = new Map<string, EventRow[]>();
    for (const e of rows) {
      const list = byType.get(e.eventType);
      if (list) list.push(e);
      else byType.set(e.eventType, [e]);
    }
    const count = (type: string) => byType.get(type)?.length ?? 0;
    const lastOf = (type: string): Date | null => {
      const list = byType.get(type);
      return list && list.length ? list[list.length - 1].createdAt : null;
    };

    // ── actividad y sesiones ──
    const sessions = buildSessions(rows);
    const sessionMinutes = sessions.map(
      (s) => (s.endedAt.getTime() - s.startedAt.getTime()) / 60000
    );
    const totalSessionMinutes = sessionMinutes.reduce((a, b) => a + b, 0);
    const activeDayKeys = rows.map((e) => dayKey(e.createdAt));
    const uniqueDays = Array.from(new Set(activeDayKeys));
    const { current: currentStreak, longest: longestStreak } = streaks(uniqueDays);

    // Serie diaria de los últimos 90 días: eventos + minutos activos.
    const minutesByDay = new Map<string, number>();
    for (const s of sessions) {
      const k = dayKey(s.startedAt);
      const mins = (s.endedAt.getTime() - s.startedAt.getTime()) / 60000;
      minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + mins);
    }
    const eventsByDay = new Map<string, number>();
    for (const k of activeDayKeys) eventsByDay.set(k, (eventsByDay.get(k) ?? 0) + 1);
    const daily: Array<{ date: string; events: number; minutes: number }> = [];
    for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86400000));
      daily.push({
        date: k,
        events: eventsByDay.get(k) ?? 0,
        minutes: round1(minutesByDay.get(k) ?? 0),
      });
    }

    // Plataforma: se lee de metadata.platform en cada evento.
    // "android" cuenta aparte: metido en el saco de iOS, la ficha afirmaba un
    // iPhone que esta persona no tiene. "mobile" es el valor viejo y genérico,
    // de cuando la app sólo existía en iPhone.
    const platformCounts = { ios: 0, android: 0, web: 0, unknown: 0 };
    for (const e of rows) {
      const pf = str(meta(e).platform);
      if (pf === "android") platformCounts.android += 1;
      else if (pf === "ios" || pf === "mobile") platformCounts.ios += 1;
      else if (pf === "web") platformCounts.web += 1;
      else platformCounts.unknown += 1;
    }

    // ── escucha por historia ──
    type StoryAgg = {
      slug: string;
      bookSlug: string | null;
      maxProgressSec: number;
      durationSec: number | null;
      plays: number;
      completions: number;
      opens: number;
      lastAt: Date | null;
    };
    const storyAgg = new Map<string, StoryAgg>();
    const getAgg = (slug: string, bookSlug: string | null): StoryAgg => {
      let agg = storyAgg.get(slug);
      if (!agg) {
        agg = {
          slug,
          bookSlug,
          maxProgressSec: 0,
          durationSec: null,
          plays: 0,
          completions: 0,
          opens: 0,
          lastAt: null,
        };
        storyAgg.set(slug, agg);
      }
      if (!agg.bookSlug && bookSlug) agg.bookSlug = bookSlug;
      return agg;
    };

    for (const e of rows) {
      if (!isRealStory(e.storySlug)) continue;
      const agg = getAgg(e.storySlug, e.bookSlug);
      if (!agg.lastAt || e.createdAt > agg.lastAt) agg.lastAt = e.createdAt;
      const m = meta(e);
      const dur = num(m.audioDurationSec);
      if (dur && dur > 0) agg.durationSec = dur;

      if (e.eventType === "audio_play") agg.plays += 1;
      else if (e.eventType === "audio_complete") agg.completions += 1;
      else if (e.eventType === "story_opened") agg.opens += 1;

      if (
        e.eventType === "audio_pause" ||
        e.eventType === "continue_listening" ||
        e.eventType === "audio_complete"
      ) {
        const progress = num(m.progressSec) ?? num(e.value) ?? 0;
        if (progress > agg.maxProgressSec) agg.maxProgressSec = progress;
      }
    }
    // Las filas de "seguir escuchando" son la fuente autoritativa del progreso
    // guardado; pueden ser más recientes que el último evento capturado.
    for (const r of resumeRows) {
      const agg = getAgg(r.storySlug, r.bookSlug);
      if ((r.progressSec ?? 0) > agg.maxProgressSec) agg.maxProgressSec = r.progressSec ?? 0;
      if (r.audioDurationSec && r.audioDurationSec > 0) agg.durationSec = r.audioDurationSec;
      if (!agg.lastAt || r.lastPlayedAt > agg.lastAt) agg.lastAt = r.lastPlayedAt;
    }

    const storyInfo = await resolveStories(Array.from(storyAgg.keys()));
    const info = (slug: string): StoryInfo =>
      storyInfo.get(slug) ?? { title: humanizeSlug(slug), language: null, resolved: false };

    const listenedStories = Array.from(storyAgg.values())
      .map((a) => {
        const i = info(a.slug);
        return {
          slug: a.slug,
          title: i.title,
          titleResolved: i.resolved,
          language: i.language,
          bookSlug: a.bookSlug,
          minutes: round1(a.maxProgressSec / 60),
          seconds: Math.round(a.maxProgressSec),
          durationSec: a.durationSec,
          progressPct:
            a.durationSec && a.durationSec > 0
              ? Math.min(100, Math.round((a.maxProgressSec / a.durationSec) * 100))
              : null,
          plays: a.plays,
          completions: a.completions,
          opens: a.opens,
          lastAt: a.lastAt ? a.lastAt.toISOString() : null,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);

    const totalListenedSeconds = listenedStories.reduce((s, x) => s + x.seconds, 0);
    const plays = count("audio_play");
    const completions = count("audio_complete");

    const inProgress = resumeRows
      .filter((r) => (r.progressSec ?? 0) > 0)
      .map((r) => {
        const i = info(r.storySlug);
        return {
          slug: r.storySlug,
          title: i.title,
          titleResolved: i.resolved,
          language: i.language,
          progressSec: r.progressSec ?? 0,
          durationSec: r.audioDurationSec,
          pct:
            r.audioDurationSec && r.audioDurationSec > 0
              ? Math.min(100, Math.round(((r.progressSec ?? 0) / r.audioDurationSec) * 100))
              : null,
          lastPlayedAt: r.lastPlayedAt.toISOString(),
        };
      })
      .slice(0, 12);

    // ── práctica ──
    const practiceStarted = byType.get("practice_session_started") ?? [];
    const practiceDone = byType.get("practice_session_completed") ?? [];
    const accuracies = practiceDone
      .map((e) => num(meta(e).accuracyPercent))
      .filter((v): v is number => v !== null);
    const practiceItems = practiceDone.reduce(
      (s, e) => s + (num(meta(e).itemsCount) ?? 0),
      0
    );
    const modeAgg = new Map<string, { sessions: number; accuracySum: number; scored: number }>();
    for (const e of practiceDone) {
      const mode = str(meta(e).mode) ?? "sin modo";
      const acc = num(meta(e).accuracyPercent);
      const cur = modeAgg.get(mode) ?? { sessions: 0, accuracySum: 0, scored: 0 };
      cur.sessions += 1;
      if (acc !== null) {
        cur.accuracySum += acc;
        cur.scored += 1;
      }
      modeAgg.set(mode, cur);
    }

    // ── vocabulario ──
    const vocabClicks = byType.get("vocab_clicked") ?? [];
    const wordCounts = new Map<string, number>();
    for (const e of vocabClicks) {
      const w = str(meta(e).word);
      if (!w) continue;
      const key = w.toLowerCase();
      wordCounts.set(key, (wordCounts.get(key) ?? 0) + 1);
    }

    // ── journeys ──
    const journeyEventTypes = [
      "journey_variant_selected",
      "journey_topic_opened",
      "journey_story_read",
      "journey_topic_checkpoint_complete",
      "practice_recommended_mode_opened",
      "checkpoint_recovery_clicked",
    ];
    const variantCounts = new Map<string, number>();
    const variantLast = new Map<string, Date>();
    const topicCounts = new Map<string, number>();
    for (const type of journeyEventTypes) {
      for (const e of byType.get(type) ?? []) {
        const m = meta(e);
        const vid = str(m.variantId);
        if (vid) {
          variantCounts.set(vid, (variantCounts.get(vid) ?? 0) + 1);
          variantLast.set(vid, e.createdAt);
        }
        const tid = str(m.topicId);
        if (tid) topicCounts.set(tid, (topicCounts.get(tid) ?? 0) + 1);
      }
    }
    const variantIds = Array.from(variantCounts.keys());
    const topicIds = Array.from(topicCounts.keys());
    const [journeyRows, topicRows] = await Promise.all([
      variantIds.length
        ? prisma.journey.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, name: true, language: true, variant: true, status: true },
          })
        : Promise.resolve([]),
      topicIds.length
        ? prisma.topic.findMany({
            where: { slug: { in: topicIds } },
            select: { slug: true, label: true },
          })
        : Promise.resolve([]),
    ]);
    const journeyById = new Map(journeyRows.map((j) => [j.id, j]));
    const topicLabel = new Map(topicRows.map((t) => [t.slug, t.label]));

    // ── notificaciones ──
    const targetCounts = new Map<string, number>();
    for (const e of byType.get("reminder_tapped") ?? []) {
      const kind = str(meta(e).targetKind) ?? "sin destino";
      targetCounts.set(kind, (targetCounts.get(kind) ?? 0) + 1);
    }
    const reminderScheduled = count("reminder_scheduled");
    const reminderTapped = count("reminder_tapped");

    // ── monetización ──
    const ctaSources = new Map<string, number>();
    for (const e of byType.get("upgrade_cta_clicked") ?? []) {
      const src = str(meta(e).source) ?? str(meta(e).cta) ?? "sin origen";
      ctaSources.set(src, (ctaSources.get(src) ?? 0) + 1);
    }

    // ── onboarding ──
    const stepsCompleted = Array.from(
      new Set(
        (byType.get("onboarding_step_completed") ?? [])
          .map((e) => num(meta(e).step))
          .filter((v): v is number => v !== null)
      )
    ).sort((a, b) => a - b);
    const lastStepMeta = meta(
      (byType.get("onboarding_step_completed") ?? []).slice(-1)[0] ?? { metadata: null }
    );

    // ── timeline ──
    const timeline = rows
      .slice(-TIMELINE_LIMIT)
      .reverse()
      .map((e) => {
        const m = meta(e);
        const real = isRealStory(e.storySlug);
        const i = real ? info(e.storySlug) : null;
        const bits: string[] = [];
        const mode = str(m.mode);
        const acc = num(m.accuracyPercent);
        const word = str(m.word);
        const progress = num(m.progressSec);
        const targetKind = str(m.targetKind);
        const source = str(m.source);
        if (mode) bits.push(mode);
        if (acc !== null && e.eventType === "practice_session_completed") bits.push(`${acc}%`);
        if (word) bits.push(`"${word}"`);
        if (progress !== null && progress > 0) bits.push(`${Math.round(progress)}s`);
        if (targetKind) bits.push(targetKind);
        if (source && !mode) bits.push(source);
        return {
          at: e.createdAt.toISOString(),
          eventType: e.eventType,
          storySlug: real ? e.storySlug : null,
          storyTitle: i ? i.title : null,
          platform: str(m.platform),
          detail: bits.join(" · ") || null,
        };
      });

    const publicMd = (clerkUser?.publicMetadata ?? {}) as Meta;
    const privateMd = (clerkUser?.privateMetadata ?? {}) as Meta;
    const targetLanguages = Array.isArray(publicMd.targetLanguages)
      ? (publicMd.targetLanguages as string[])
      : [];
    const pushTokens = Array.isArray(privateMd.mobilePushTokens)
      ? (privateMd.mobilePushTokens as unknown[]).length
      : 0;
    const signupPlatform = str(publicMd.signupPlatform);
    const inferredPlatform: "ios" | "android" | "web" | null =
      signupPlatform === "ios" || signupPlatform === "android" || signupPlatform === "web"
        ? (signupPlatform as "ios" | "android" | "web")
        : platformCounts.android > 0
          ? "android"
          : platformCounts.ios > platformCounts.web
            ? "ios"
            : platformCounts.web > 0
              ? "web"
              // El token de push no distingue sistema: sólo dice que la app
              // está instalada. Los que lo tienen sin más señal son testers
              // de iPhone, que son los únicos que la tuvieron antes del sello.
              : pushTokens > 0
                ? "ios"
                : null;

    const payload = {
      user: {
        userId,
        name: clerkUser
          ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null
          : null,
        email,
        imageUrl: clerkUser?.imageUrl ?? null,
        createdAt: clerkUser ? new Date(clerkUser.createdAt).toISOString() : null,
        lastSignInAt: clerkUser?.lastSignInAt
          ? new Date(clerkUser.lastSignInAt).toISOString()
          : null,
        targetLanguages,
        nativeLanguage: str(publicMd.nativeLanguage),
        level: str(publicMd.preferredLevel),
        dailyMinutesGoal: num(lastStepMeta.dailyMinutes),
        remindersEnabled:
          typeof lastStepMeta.remindersEnabled === "boolean"
            ? (lastStepMeta.remindersEnabled as boolean)
            : null,
        platform: inferredPlatform,
        signupPlatform,
        pushTokens,
        clerkFound: !!clerkUser,
      },
      plan: entitlement
        ? {
            plan: entitlement.plan,
            status: entitlement.status,
            source: entitlement.source,
            productId: entitlement.productId,
            willRenew: entitlement.willRenew,
            startedAt: entitlement.startedAt.toISOString(),
            renewedAt: entitlement.renewedAt?.toISOString() ?? null,
            trialEndsAt: entitlement.trialEndsAt?.toISOString() ?? null,
            expiresAt: entitlement.expiresAt?.toISOString() ?? null,
          }
        : null,
      beta: betaSignup
        ? {
            status: betaSignup.status,
            appliedAt: betaSignup.createdAt.toISOString(),
            invitedAt: betaSignup.invitedAt?.toISOString() ?? null,
            targetLanguage: betaSignup.targetLanguage,
            currentLevel: betaSignup.currentLevel,
            weeklyHours: betaSignup.weeklyHours,
            referralSource: betaSignup.referralSource,
            feedbackCount: betaFeedback.length,
            recentFeedback: betaFeedback.map((f) => ({
              kind: f.kind,
              rating: f.rating,
              status: f.status,
              message: f.message.slice(0, 220),
              at: f.createdAt.toISOString(),
            })),
          }
        : null,
      emailPrefs: emailPref
        ? {
            progress: emailPref.progress,
            reminders: emailPref.reminders,
            unsubscribedAll: emailPref.unsubscribedAll,
          }
        : null,
      activity: {
        totalEvents: rows.length,
        truncated: rows.length >= MAX_EVENTS,
        firstEventAt: rows[0]?.createdAt.toISOString() ?? null,
        lastEventAt: rows[rows.length - 1]?.createdAt.toISOString() ?? null,
        activeDays: uniqueDays.length,
        currentStreakDays: currentStreak,
        longestStreakDays: longestStreak,
        sessions: sessions.length,
        totalActiveMinutes: round1(totalSessionMinutes),
        avgSessionMinutes: sessions.length ? round1(totalSessionMinutes / sessions.length) : 0,
        longestSessionMinutes: sessionMinutes.length ? round1(Math.max(...sessionMinutes)) : 0,
        byPlatform: platformCounts,
        daily,
        recentSessions: sessions
          .slice(-15)
          .reverse()
          .map((s) => ({
            startedAt: s.startedAt.toISOString(),
            endedAt: s.endedAt.toISOString(),
            minutes: round1((s.endedAt.getTime() - s.startedAt.getTime()) / 60000),
            events: s.events,
            stories: Array.from(s.stories).map((slug) => info(slug).title),
          })),
      },
      listening: {
        totalMinutes: round1(totalListenedSeconds / 60),
        plays,
        completions,
        completionRate: plays > 0 ? Math.round((completions / plays) * 100) : 0,
        storiesOpened: count("story_opened"),
        uniqueStories: listenedStories.length,
        uniqueBooks: new Set(
          listenedStories.map((s) => s.bookSlug).filter((b): b is string => !!b)
        ).size,
        seeks: count("seek"),
        speedChanges: count("speed_change"),
        lastSpeed: (() => {
          const last = (byType.get("speed_change") ?? []).slice(-1)[0];
          return last ? num(last.value) : null;
        })(),
        stories: listenedStories.slice(0, 15),
        inProgress,
      },
      practice: {
        started: practiceStarted.length,
        completed: practiceDone.length,
        completionRate: practiceStarted.length
          ? Math.round((practiceDone.length / practiceStarted.length) * 100)
          : 0,
        avgAccuracy: accuracies.length
          ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
          : null,
        totalItems: practiceItems,
        lastAt: lastOf("practice_session_completed")?.toISOString() ?? null,
        recommendedModeOpened: count("practice_recommended_mode_opened"),
        byMode: Array.from(modeAgg.entries())
          .map(([mode, v]) => ({
            mode,
            sessions: v.sessions,
            avgAccuracy: v.scored ? Math.round(v.accuracySum / v.scored) : null,
          }))
          .sort((a, b) => b.sessions - a.sessions),
        recent: practiceDone
          .slice(-10)
          .reverse()
          .map((e) => {
            const m = meta(e);
            const i = isRealStory(e.storySlug) ? info(e.storySlug) : null;
            return {
              at: e.createdAt.toISOString(),
              mode: str(m.mode),
              storySlug: isRealStory(e.storySlug) ? e.storySlug : null,
              storyTitle: i?.title ?? str(m.storyTitle),
              accuracy: num(m.accuracyPercent),
              items: num(m.itemsCount),
            };
          }),
      },
      vocab: {
        clicks: vocabClicks.length,
        uniqueWords: wordCounts.size,
        savedWords: favoriteCount,
        collections: collectionCount,
        topWords: topCounts(wordCounts, 12).map((w) => ({ word: w.key, count: w.count })),
        recentSaved: favorites.map((f) => ({
          word: f.word,
          translation: f.translation,
          wordType: f.wordType,
          language: f.language,
          storyTitle: f.storyTitle,
          streak: f.streak,
          createdAt: f.createdAt.toISOString(),
        })),
      },
      journeys: {
        variantSelected: count("journey_variant_selected"),
        topicOpened: count("journey_topic_opened"),
        storiesRead: count("journey_story_read"),
        checkpoints: count("journey_topic_checkpoint_complete"),
        checkpointRecovery: count("checkpoint_recovery_clicked"),
        variants: topCounts(variantCounts, 8).map((v) => {
          const j = journeyById.get(v.key);
          return {
            variantId: v.key,
            // El journey pudo borrarse después de que el usuario pasara por él;
            // la actividad sigue siendo real, así que se muestra igual.
            name: j?.name ?? "(journey eliminado)",
            language: j ? normalizeLanguageCode(j.language) : null,
            variant: j?.variant ?? null,
            status: j?.status ?? null,
            events: v.count,
            lastAt: variantLast.get(v.key)?.toISOString() ?? null,
          };
        }),
        topics: topCounts(topicCounts, 10).map((t) => ({
          topicId: t.key,
          label: topicLabel.get(t.key) ?? t.key,
          opens: t.count,
        })),
      },
      notifications: {
        scheduled: reminderScheduled,
        tapped: reminderTapped,
        destinationOpened: count("reminder_destination_opened"),
        pushOpened: count("push_opened"),
        tapRate: reminderScheduled
          ? Math.round((reminderTapped / reminderScheduled) * 100)
          : 0,
        byTarget: topCounts(targetCounts, 6).map((t) => ({ kind: t.key, count: t.count })),
      },
      monetization: {
        plansViewed: count("plans_viewed"),
        lastPlansViewedAt: lastOf("plans_viewed")?.toISOString() ?? null,
        upgradeCtaClicks: count("upgrade_cta_clicked"),
        ctaSources: topCounts(ctaSources, 6).map((c) => ({ source: c.key, count: c.count })),
        trialStarted: count("trial_started"),
        trialStartedWithPm: count("trial_started_with_pm"),
        trialConverted: count("trial_converted"),
        trialCanceled: count("trial_canceled"),
        paid: !!entitlement && !(entitlement.plan ?? "").toLowerCase().includes("free"),
      },
      onboarding: {
        started: count("onboarding_started") > 0,
        stepsCompleted,
        finished: count("onboarding_finished") > 0,
        finishedAt: lastOf("onboarding_finished")?.toISOString() ?? null,
        abandoned: count("onboarding_abandoned") > 0,
        levelTestStarted: count("onboarding_level_test_started") > 0,
        levelTestCompleted: count("onboarding_level_test_completed") > 0,
      },
      library: {
        savedStories,
        savedBooks,
        favorites: favoriteCount,
        collections: collectionCount,
        ownStories: userStoryCount,
      },
      timeline,
    };

    cache.set(userId, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("❌ /api/metrics/user/[userId] error:", err);
    return NextResponse.json(
      {
        error: "Failed to load user metrics",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
}
