export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInternalUserIds, isMetricsAccessAllowed } from "@/lib/metricsAccess";
import { buildMetricsUserScope, parseMetricsCohort } from "@/lib/metricsCohort";
import { resolveUserEmails, resolveUserIdentities } from "@/lib/metricsUserEmails";
import type { MetricsIdentityStatus } from "@/lib/metricsUserEmails";
import type { CatalogHealth } from "@/components/studio/metrics/types";
import { localDayKey, startOfLocalDay, startOfLocalDaysAgo } from "@/lib/metricsTime";
import { ACTIVITY_EVENT_WHERE, isProgressEvent } from "@/lib/metricsActivity";
import { books } from "@/data/books";
import { getStandaloneStoriesByIds, getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";
import {
  computeLearningMetrics,
  emptyLearningMetrics,
  type LearningMetrics,
  type LearningPracticeRow,
  type LearningVocabRow,
} from "@/lib/learningMetrics";
import {
  computeRatingsMetrics,
  emptyRatingsMetrics,
  type RatingsMetrics,
} from "@/lib/metricsRatings";

const METRICS_DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const RECENT_TRIAL_STARTS_LIMIT = 20;
const RECENT_REMINDER_TAPS_LIMIT = 20;
const RECENT_REMINDER_OPENS_LIMIT = 20;

const metricsDashboardCache = new Map<
  string,
  { createdAt: number; payload: DashboardResponse }
>();

type EventRow = {
  userId: string;
  bookSlug: string | null;
  storySlug: string;
  eventType: string;
  createdAt: Date;
};

type ProgressRow = {
  userId: string;
  storySlug: string;
  value: number | null;
  metadata?: unknown;
  createdAt?: Date;
};

type SavedStoryRow = {
  storyId: string;
  _count: { _all: number };
};

type SavedBookRow = {
  bookId: string;
  _count: { _all: number };
};

type TrialStartRow = {
  userId: string;
  eventType: string;
  createdAt: Date;
};

type ReminderTapRow = {
  userId: string;
  eventType: string;
  createdAt: Date;
  metadata?: unknown;
};

/**
 * Una persona en la tabla de Audiencia. Cada cifra viene con su gemela del
 * periodo anterior (mismo número de días, justo antes), que es lo que permite
 * leer la fila como "mejora" o "empeora" en vez de como un número suelto.
 */
type MetricsPerUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  minutes: number;
  prevMinutes: number;
  activeDays: number;
  prevActiveDays: number;
  storiesFinished: number;
  prevStoriesFinished: number;
  practices: number;
  prevPractices: number;
  /** Última señal suya en el rango. */
  lastAt: string | null;
};

/** Una persona detrás de una tarjeta de KPI. */
type MetricsKpiUser = {
  userId: string;
  name: string | null;
  email: string | null;
  /** Si Clerk conoce la cuenta. `deleted` es la que ya no existe. */
  identityStatus: MetricsIdentityStatus;
  /** Eventos suyos en la ventana de la tarjeta (hoy en DAU, 7d en WAU). */
  events: number;
  /** Minutos de audio en esa ventana: lo que un recuento de eventos no dice. */
  minutes: number;
  /** Su última señal, para poder ordenar por quién sigue ahí. */
  lastAt: string | null;
};

type DashboardResponse = {
  /**
   * Cuando se CALCULARON estos numeros, no cuando se pidieron.
   *
   * La respuesta se cachea 60 s, asi que dos cargas seguidas pueden devolver
   * la misma foto. La cabecera decia "actualizado ahora" siempre, y el usuario
   * lo noto al recargar y ver cambiar las cifras de un "ahora" al siguiente.
   * Como el sello viaja DENTRO del payload cacheado, un acierto de cache
   * devuelve su hora original y la cabecera puede decir "hace 40 s".
   */
  generatedAt: string;
  range: {
    from: string;
    to: string;
    days: number;
  };
  prevRange?: {
    from: string;
    to: string;
    days: number;
  };
  prevKpis?: {
    dau: number;
    wau: number;
    dauMauPct: number;
    exercisesPerPractitioner: number;
    activeUsersInRange: number;
    plays: number;
    completions: number;
    completionRate: number;
    uniqueStories: number;
    uniqueBooks: number;
    minutesPerListener: number;
    listeners: number;
    totalListenedMinutes: number;
    savedStories: number;
    savedBooks: number;
  };
  kpis: {
    dau: number;
    wau: number;
    mau: number;
    dauMauPct: number;
    activeUsersInRange: number;
    plays: number;
    completions: number;
    completionRate: number;
    uniqueStories: number;
    uniqueBooks: number;
    /** Minutos entre quien REPRODUJO algo, no entre todo el que dio señal. */
    minutesPerListener: number;
    /** Cuántas personas reprodujeron algo en el rango. */
    listeners: number;
    /** Ejercicios entre quien PRACTICÓ, no entre todo el que dio señal. */
    exercisesPerPractitioner: number;
    /** Cuántas personas terminaron alguna sesión de práctica. */
    practitioners: number;
    totalListenedMinutes: number;
    savedStories: number;
    savedBooks: number;
    /** Parejas persona+historia con alguna señal en el rango. */
    storiesStarted: number;
    /** De esas, las que llegaron al final. */
    storiesFinished: number;
  };
  /**
   * Quién compone el DAU y el WAU. Un "4" no dice si son cuatro personas
   * distintas de ayer o las mismas de siempre, y esa es justo la pregunta
   * que sigue a la cifra cuando hay cuatro.
   */
  kpiUsers: {
    dau: MetricsKpiUser[];
    wau: MetricsKpiUser[];
  };
  daily: Array<{
    date: string;
    plays: number;
    completions: number;
    completionRate: number;
    minutesPerListener: number;
    exercisesPerPractitioner: number;
    activeUsers: number;
    wau: number;
    dauMauPct: number;
    listenedMinutes: number;
  }>;
  audiobookSplit: Array<{
    book: string;
    users: number;
    started: number;
    finished: number;
    completionRate: number;
    minutes: number;
  }>;
  languageSplit: Array<{
    language: string;
    variant: string;
    users: number;
    started: number;
    finished: number;
    completionRate: number;
    minutes: number;
  }>;
  topStories: Array<{
    storySlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topBooks: Array<{
    bookSlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topStoriesByMinutes: Array<{
    storySlug: string;
    listenedMinutes: number;
    listeners: number;
    /** Canonical language code (es / it / de / fr / pt / en) resolved from
     * the story's metadata. `null` when the slug doesn't match any known
     * source. Replaces the previous slug-regex heuristic on the client
     * that produced false positives (e.g. "dia-de-muertos" → "de"). */
    language: string | null;
  }>;
  topSavedStories: Array<{
    storySlug: string;
    saves: number;
  }>;
  topSavedBooks: Array<{
    bookSlug: string;
    saves: number;
  }>;
  signups: {
    total: number;
    last7d: number;
    last30d: number;
  };
  recentSignups: Array<{
    userId: string;
    email: string | null;
    createdAt: string;
  }>;
  trialFunnel: {
    started: number;
    startedWithPm: number;
    day1Active: number;
    converted: number;
    canceled: number;
    conversionRate: number;
    day1ActivationRate: number;
    cancelRate: number;
  };
  recentTrialStarts: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    createdAt: string;
  }>;
  recentReminderTaps: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    destination: string | null;
    source: string | null;
    createdAt: string;
  }>;
  recentReminderOpens: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    destination: string | null;
    createdAt: string;
  }>;
  checkoutFunnel: {
    plansViewed: number;
    checkoutStarted: number;
    checkoutRedirected: number;
    checkoutFailed: number;
    checkoutStartRate: number;
    checkoutRedirectRate: number;
  };
  upgradeCtaSources: Array<{
    source: string;
    clicks: number;
  }>;
  journeyFunnel: {
    variantSelected: number;
    levelSelected: number;
    topicOpened: number;
    nextActionClicked: number;
    reviewCtaClicked: number;
    checkpointRecoveryClicked: number;
    recommendedModeOpened: number;
    topicOpenRateFromVariant: number;
    nextActionRateFromTopicOpen: number;
    reviewRateFromTopicOpen: number;
  };
  reminderFunnel: {
    scheduled: number;
    tapped: number;
    destinationOpened: number;
    /** Personas distintas con el recordatorio diario puesto. */
    usersWithReminder: number;
    /** Taps en el rango por cada una de esas personas. */
    tapsPerUserWithReminder: number;
    openRateFromTap: number;
    destinationBreakdown: Array<{
      destination: string;
      opens: number;
    }>;
  };
  audience: {
    onboardingFunnel: {
      started: number;
      step1Completed: number;
      step2Completed: number;
      step3Completed: number;
      finished: number;
      abandoned: number;
      levelTestStarted: number;
      levelTestCompleted: number;
      step1Rate: number;
      step2Rate: number;
      step3Rate: number;
      finishRate: number;
      levelTestCompleteRate: number;
    };
    weeklyActivity: {
      activeUsersLast7Days: number;
      usersOver5Min: number;
      usersOver10Min: number;
      usersOver30Min: number;
      usersOver60Min: number;
      activationRate10MinPct: number;
      medianMinutes: number;
      avgMinutesLast7Days: number;
      distribution: Array<{ bucket: string; users: number }>;
    };
    /**
     * Una fila por persona activa en el rango, con lo mismo medido en el
     * periodo anterior al lado. Las medias del panel esconden justo lo que se
     * quiere saber: si alguien concreto va a más o a menos.
     */
    perUser: MetricsPerUserRow[];
  };
  learning: LearningMetrics;
  ratings: RatingsMetrics;
  catalog: CatalogHealth | null;
};

type DashboardSection =
  | "overview"
  | "acquisition"
  | "engagement"
  | "learning"
  | "content"
  | "funnels"
  | "audience"
  | "audiobooks"
  | "alerts";

function parseSection(raw: string | null): DashboardSection {
  switch (raw) {
    case "acquisition":
    case "engagement":
    case "learning":
    case "content":
    case "funnels":
    case "audience":
    case "audiobooks":
    case "alerts":
      return raw;
    case "overview":
    default:
      return "overview";
  }
}

function createEmptyDashboardResponse(from: Date, to: Date, days: number): DashboardResponse {
  return {
    generatedAt: new Date().toISOString(),
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
    kpis: {
      dau: 0,
      wau: 0,
      mau: 0,
      dauMauPct: 0,
      activeUsersInRange: 0,
      plays: 0,
      completions: 0,
      completionRate: 0,
      uniqueStories: 0,
      uniqueBooks: 0,
      minutesPerListener: 0,
      listeners: 0,
      exercisesPerPractitioner: 0,
      practitioners: 0,
      totalListenedMinutes: 0,
      savedStories: 0,
      savedBooks: 0,
      storiesStarted: 0,
      storiesFinished: 0,
    },
    kpiUsers: { dau: [], wau: [] },
    languageSplit: [],
    audiobookSplit: [],
    daily: [],
    topStories: [],
    topBooks: [],
    topStoriesByMinutes: [],
    topSavedStories: [],
    topSavedBooks: [],
    signups: { total: 0, last7d: 0, last30d: 0 },
    recentSignups: [],
    trialFunnel: {
      started: 0,
      startedWithPm: 0,
      day1Active: 0,
      converted: 0,
      canceled: 0,
      conversionRate: 0,
      day1ActivationRate: 0,
      cancelRate: 0,
    },
    recentTrialStarts: [],
    recentReminderTaps: [],
    recentReminderOpens: [],
    checkoutFunnel: {
      plansViewed: 0,
      checkoutStarted: 0,
      checkoutRedirected: 0,
      checkoutFailed: 0,
      checkoutStartRate: 0,
      checkoutRedirectRate: 0,
    },
    upgradeCtaSources: [],
    journeyFunnel: {
      variantSelected: 0,
      levelSelected: 0,
      topicOpened: 0,
      nextActionClicked: 0,
      reviewCtaClicked: 0,
      checkpointRecoveryClicked: 0,
      recommendedModeOpened: 0,
      topicOpenRateFromVariant: 0,
      nextActionRateFromTopicOpen: 0,
      reviewRateFromTopicOpen: 0,
    },
    reminderFunnel: {
      scheduled: 0,
      tapped: 0,
      destinationOpened: 0,
      usersWithReminder: 0,
      tapsPerUserWithReminder: 0,
      openRateFromTap: 0,
      destinationBreakdown: [],
    },
    audience: {
      onboardingFunnel: {
        started: 0,
        step1Completed: 0,
        step2Completed: 0,
        step3Completed: 0,
        finished: 0,
        abandoned: 0,
        levelTestStarted: 0,
        levelTestCompleted: 0,
        step1Rate: 0,
        step2Rate: 0,
        step3Rate: 0,
        finishRate: 0,
        levelTestCompleteRate: 0,
      },
      weeklyActivity: {
        activeUsersLast7Days: 0,
        usersOver5Min: 0,
        usersOver10Min: 0,
        usersOver30Min: 0,
        usersOver60Min: 0,
        activationRate10MinPct: 0,
        medianMinutes: 0,
        avgMinutesLast7Days: 0,
        distribution: [],
      },
      perUser: [],
    },
    learning: emptyLearningMetrics(),
    ratings: emptyRatingsMetrics(),
    catalog: null,
  };
}

function parseDays(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(180, Math.max(1, Math.floor(parsed)));
}

export type MetricsPlatform = "all" | "web" | "ios" | "android";

function parsePlatform(raw: string | null): MetricsPlatform {
  if (raw === "web" || raw === "ios" || raw === "android") return raw;
  return "all";
}

/** Grano de las series temporales: un punto por día o uno por semana. */
function parseGrain(raw: string | null): "day" | "week" {
  return raw === "week" ? "week" : "day";
}

/**
 * Filtro de plataforma para el `where` de cada consulta.
 *
 * CUIDADO con lo que deja fuera: `metadata.platform` se empezó a sellar más
 * tarde que el resto, así que las filas antiguas no lo traen. Con el selector
 * en "Todos" entran igual; en cuanto se elige una plataforma, desaparecen. Es
 * lo correcto (no se puede afirmar que una fila sin sello sea de iOS) pero
 * significa que la suma de las tres NO da el total.
 */
function platformWhere(platform: MetricsPlatform) {
  if (platform === "all") return {};
  return { metadata: { path: ["platform"], equals: platform } };
}

/**
 * Los `storySlug` que NO son de un journey, o sea: los audiolibros.
 *
 * El discriminador tiene que ser el slug de la historia y no `bookSlug`.
 * Comprobado el 2026-09-24: los cubos `standalone`, `standalone-stories` y
 * `null` llevan historias de las DOS clases (217+207+202 de journey contra
 * 25+7+89 de libro), así que filtrar por libro se lleva por delante journeys.
 *
 * Con esto los gráficos del Studio cuentan solo journeys y la pestaña
 * Audiobooks cuenta solo libros. Se corta por ACTIVIDAD y no por persona: de
 * los 23 que usan las dos cosas, 14 aportan el 46% de las historias de journey
 * terminadas del mes, y 16 de esos 23 entraron por un journey, no por un
 * libro. Quien solo tiene libros desaparece igual de los recuentos de
 * personas, porque ninguno de esos 72 tiene un solo evento fuera de un libro.
 */
let cacheLibros: { slugs: string[]; at: number } | null = null;
const LIBROS_TTL_MS = 5 * 60 * 1000;

async function getAudiobookStorySlugs(): Promise<string[]> {
  if (cacheLibros && Date.now() - cacheLibros.at < LIBROS_TTL_MS) return cacheLibros.slugs;
  const vistos = await prisma.userMetric.findMany({
    distinct: ["storySlug"],
    select: { storySlug: true },
  });
  const slugs = vistos.map((r) => r.storySlug).filter(Boolean) as string[];
  const deJourney = new Set(
    (
      await prisma.journeyStory.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true },
      })
    ).map((h) => h.slug),
  );
  const libros = slugs.filter((s) => !deJourney.has(s));
  cacheLibros = { slugs: libros, at: Date.now() };
  return libros;
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * La fecha de la fila, en el huso del panel. En UTC, la columna de hoy
 * empezaba a las 02:00 de la madrugada de aquí y se llevaba dos horas de ayer.
 */
function toDayKey(date: Date): string {
  return localDayKey(date);
}

function getSavedStoryFilter(storySlug: string | null, storyIdsForFilter: string[]) {
  if (!storySlug) return {};
  if (storyIdsForFilter.length === 0) {
    return { storyId: "__no_matching_story__" };
  }
  return { storyId: { in: storyIdsForFilter } };
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getProgressValue(row: ProgressRow): number {
  const direct = toNumber(row.value);
  if (direct !== null) return direct;

  if (!row.metadata || typeof row.metadata !== "object") return 0;
  const metadata = row.metadata as Record<string, unknown>;
  return toNumber(metadata.progressSec) ?? 0;
}

async function resolveStoryIdsForSlug(slug: string): Promise<string[]> {
  const localIds = Object.values(books)
    .flatMap((book) => book.stories)
    .filter((story) => story.slug === slug)
    .map((story) => story.id);

  const [polyglotStories, standaloneStories] = await Promise.all([
    prisma.userStory.findMany({
      where: { slug },
      select: { id: true },
      take: 20,
    }),
    getStandaloneStoriesBySlugs([slug]),
  ]);

  return Array.from(
    new Set([
      ...localIds,
      ...polyglotStories.map((story) => story.id),
      ...standaloneStories.map((story) => story.id),
    ])
  );
}

/**
 * For every story slug, returns its canonical language code (es / it / de /
 * fr / pt / en). Looks in the local catalog first (Book.language inherits
 * to its stories), then UserStory.language, then StandaloneStory.language.
 * Slugs that can't be resolved get `null` (no language chip rendered).
 */
async function resolveStoryLanguageMap(
  storySlugs: string[]
): Promise<Map<string, string>> {
  if (storySlugs.length === 0) return new Map();

  const slugSet = new Set(storySlugs);
  const out = new Map<string, string>();

  // 1) Local catalog. Each Book has a language; every story inside
  // inherits that language for display purposes.
  for (const book of Object.values(books)) {
    const lang = (book as { language?: string }).language;
    if (!lang) continue;
    for (const story of book.stories) {
      if (slugSet.has(story.slug)) {
        out.set(story.slug, normalizeLanguageCode(lang));
      }
    }
  }

  // 2) UserStory + StandaloneStory for whatever still isn't resolved.
  const unresolved = storySlugs.filter((s) => !out.has(s));
  if (unresolved.length === 0) return out;

  const [userStories, standaloneStories] = await Promise.all([
    prisma.userStory.findMany({
      where: { slug: { in: unresolved } },
      select: { slug: true, language: true },
    }),
    getStandaloneStoriesBySlugs(unresolved),
  ]);

  for (const s of userStories) {
    if (s.language) out.set(s.slug, normalizeLanguageCode(s.language));
  }
  for (const s of standaloneStories) {
    const lang = (s as { language?: string | null }).language;
    if (lang && !out.has(s.slug)) out.set(s.slug, normalizeLanguageCode(lang));
  }
  return out;
}

/**
 * Para cada storySlug devuelve su nivel CEFR en minúsculas (a0, a1, b1,
 * c1...). Una historia de journey viaja con DOS identidades: el slug de
 * verdad y la forma `journey-<id>` / `journey:<id>` que usa la app, así
 * que se busca por las dos y se indexa siempre por la cadena original
 * que vino en la métrica. Lo que no se resuelve queda fuera de la tabla
 * por nivel en vez de caer en un cajón "desconocido" que no dice nada.
 */
async function resolveStoryLevelMap(
  storySlugs: string[]
): Promise<Map<string, string>> {
  if (storySlugs.length === 0) return new Map();

  const out = new Map<string, string>();
  const idForm = new Map<string, string>();
  for (const raw of storySlugs) {
    const stripped = raw.replace(/^journey[-:]/, "");
    if (stripped !== raw) idForm.set(stripped, raw);
  }
  const plainSlugs = storySlugs.filter((s) => !/^journey[-:]/.test(s));
  const ids = [...idForm.keys()];

  const [journeyBySlug, journeyById, standalone, catalog] = await Promise.all([
    plainSlugs.length
      ? prisma.journeyStory.findMany({
          where: { slug: { in: plainSlugs } },
          select: { slug: true, level: true },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.journeyStory.findMany({
          where: { id: { in: ids } },
          select: { id: true, level: true },
        })
      : Promise.resolve([]),
    plainSlugs.length
      ? prisma.standaloneStory.findMany({
          where: { slug: { in: plainSlugs } },
          select: { slug: true, level: true, cefrLevel: true },
        })
      : Promise.resolve([]),
    plainSlugs.length
      ? prisma.catalogStory.findMany({
          where: { slug: { in: plainSlugs } },
          select: { slug: true, level: true, cefrLevel: true },
        })
      : Promise.resolve([]),
  ]);

  // `level` y `cefrLevel` NO son la misma columna con dos nombres.
  // `JourneyStory.level` sí guarda CEFR (a0...c2), pero en
  // `StandaloneStory` y `CatalogStory` la que lleva CEFR es `cefrLevel`
  // y `level` guarda una banda gruesa heredada del catálogo viejo
  // (beginner / intermediate / advanced). Por eso se prefiere
  // `cefrLevel` y `level` solo entra si tiene forma de código CEFR: al
  // revés, el A0/A1/C1 de la tabla acababa conviviendo con un
  // "INTERMEDIATE" que era la banda gruesa de una historia que sí tenía
  // su b1 declarado al lado.
  const CEFR_CODE = /^[abc][0-2]$/;
  const put = (key: string | null | undefined, ...candidates: Array<string | null | undefined>) => {
    if (!key || out.has(key)) return;
    for (const raw of candidates) {
      const value = raw?.trim().toLowerCase();
      if (value && CEFR_CODE.test(value)) {
        out.set(key, value);
        return;
      }
    }
  };

  for (const r of journeyBySlug) put(r.slug, r.level);
  for (const r of journeyById) {
    const original = idForm.get(r.id);
    if (original) put(original, r.level);
  }
  for (const r of standalone) put(r.slug, r.cefrLevel, r.level);
  for (const r of catalog) put(r.slug, r.cefrLevel, r.level);

  return out;
}

/**
 * Map raw `LibraryBook.bookId` -> human title. Three strategies in order:
 *   1) Exact match against CatalogBook.id (post-cutover schema where
 *      stored bookIds match catalog ids).
 *   2) Fuzzy match against CatalogBook.slug for legacy DP-* SKUs
 *      (Stripe-style product codes that contain the catalog slug
 *      uppercased + a trailing variant suffix).
 *   3) LibraryBook.title (often equals the SKU, but harmless fallback).
 *   4) Humanise the SKU directly (strip DP-, drop trailing --XXX suffix
 *      blocks, lowercase, replace dashes with spaces, title-case) so the
 *      dashboard at least reads as English rather than as a raw code.
 */
async function resolveBookTitleMap(
  bookIds: string[]
): Promise<Map<string, string>> {
  if (bookIds.length === 0) return new Map();
  const [exactCatalog, libraryRows, allCatalog] = await Promise.all([
    prisma.catalogBook.findMany({
      where: { id: { in: bookIds } },
      select: { id: true, title: true },
    }),
    prisma.libraryBook.findMany({
      where: { bookId: { in: bookIds } },
      select: { bookId: true, title: true },
      distinct: ["bookId"],
    }),
    prisma.catalogBook.findMany({
      select: { slug: true, title: true },
    }),
  ]);
  const exactById = new Map(exactCatalog.map((r) => [r.id, r.title]));
  const libraryTitle = new Map(libraryRows.map((r) => [r.bookId, r.title]));
  const out = new Map<string, string>();

  for (const id of bookIds) {
    const exact = exactById.get(id);
    if (exact) {
      out.set(id, exact);
      continue;
    }
    const fuzzy = matchCatalogByLegacySku(id, allCatalog);
    if (fuzzy) {
      out.set(id, fuzzy);
      continue;
    }
    const fromLibrary = libraryTitle.get(id);
    if (fromLibrary && fromLibrary !== id) {
      out.set(id, fromLibrary);
      continue;
    }
    out.set(id, humaniseSku(id));
  }
  return out;
}

/** Strip Shopify-style "DP-" prefix + trailing variant codes, then look up
 *  a CatalogBook whose slug contains ALL of the cleaned SKU's tokens
 *  (in any order, but every token must appear). This avoids the trap where
 *  "short-stories-in" wrongly matches `short-stories-in-argentinian-...`
 *  for a Puerto Rican SKU. */
function matchCatalogByLegacySku(
  bookId: string,
  catalog: Array<{ slug: string; title: string }>
): string | null {
  // Stripe-style codes follow `DP-<NAME>--<VARIANT>`. Split on `--` and
  // keep only the name half; strip trailing dashes; normalise to lower.
  const lower = bookId.toLowerCase().replace(/^dp-/, "");
  const beforeVariant = lower.split("--")[0];
  const cleaned = beforeVariant.replace(/-+$/, "");
  if (!cleaned) return null;
  // Solo match estricto: el catalog slug debe empezar literalmente con el
  // SKU limpio. Probamos también dropping trailing tokens (1 a la vez)
  // para tolerar truncations, PERO solo si la cola del SKU NO contenía
  // tokens "distintivos" como gentilicios; esos sí deberían disqualify.
  // Definimos distintivos por longitud: cualquier token >= 6 chars
  // (puerto, rican, colombian, argentinian, etc.) es load-bearing.
  const tokens = cleaned.split("-").filter(Boolean);
  for (let take = tokens.length; take >= 3; take -= 1) {
    const droppedTail = tokens.slice(take);
    const hasDistinctiveDropped = droppedTail.some((t) => t.length >= 6);
    if (hasDistinctiveDropped) break;
    const prefix = tokens.slice(0, take).join("-");
    const match = catalog.find((c) =>
      c.slug.toLowerCase().startsWith(prefix)
    );
    if (match) return match.title;
  }
  return null;
}

function humaniseSku(value: string): string {
  return value
    .replace(/^DP-/i, "")
    .replace(/-+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalises whatever language string the catalog stores ("spanish",
 * "italiano", "Deutsch", "de-DE"…) into the 2-letter code the client
 * components expect for the LangTag chip.
 */
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

async function resolveStorySlugMap(storyIds: string[]): Promise<Map<string, string>> {
  const localEntries = Object.values(books)
    .flatMap((book) => book.stories)
    .filter((story) => storyIds.includes(story.id))
    .map((story) => [story.id, story.slug] as const);

  const localIdSet = new Set(localEntries.map(([storyId]) => storyId));
  const unresolvedIds = storyIds.filter((id) => !localIdSet.has(id));
  const [polyglotStories, standaloneStories] = await Promise.all([
    unresolvedIds.length
      ? prisma.userStory.findMany({
          where: { id: { in: unresolvedIds } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    getStandaloneStoriesByIds(unresolvedIds),
  ]);

  return new Map([
    ...localEntries,
    ...polyglotStories.map((story) => [story.id, story.slug] as const),
    ...standaloneStories.map((story) => [story.id, story.slug] as const),
  ]);
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams;
  const section = parseSection(search.get("section"));
  const days = parseDays(search.get("days"));
  const cohort = parseMetricsCohort(search.get("cohort"));
  const platform = parsePlatform(search.get("platform"));
  const grain = parseGrain(search.get("grain"));
  const platformFilter = platformWhere(platform);
  // Los audiolibros salen de TODO el tablero y viven en su propia pestaña.
  // `section === "audiobooks"` le da la vuelta al filtro: ahi solo entran.
  const audiobookSlugs = await getAudiobookStorySlugs();
  const esAudiobooks = section === "audiobooks";
  const librosFilter =
    audiobookSlugs.length === 0
      ? {}
      : esAudiobooks
        ? { storySlug: { in: audiobookSlugs } }
        : { storySlug: { notIn: audiobookSlugs } };
  /**
   * El instante de referencia, redondeado al MINUTO hacia abajo.
   *
   * Sin esto la cache del panel no acertaba nunca: su clave lleva `from` y
   * `to`, y para un rango como 30d valían "hace 30 días" y "ahora mismo", o
   * sea que cambiaban en cada milisegundo. Cada carga recalculaba las ~30
   * consultas y la entrada cacheada no la leía nadie.
   *
   * Se redondea el INSTANTE y no solo la clave, para que dos peticiones del
   * mismo minuto midan exactamente la misma ventana: si solo se redondeara la
   * clave, la segunda recibiría numeros calculados sobre otra ventana que la
   * que su clave dice. El precio es que un evento de hace 40 s puede tardar
   * hasta el minuto siguiente en aparecer, y eso no mueve ninguna cifra del
   * panel: el DAU y el WAU van por día de calendario.
   */
  const now = new Date(Math.floor(Date.now() / 60000) * 60000);
  const defaultFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = parseDate(search.get("from")) ?? defaultFrom;
  const to = parseDate(search.get("to")) ?? now;
  // `days` se DERIVA del rango que de verdad se va a medir, en vez de creerle
  // al que llama. Con `from` y `to` puestos, el `days` de la querystring es
  // decorativo, y la interfaz lo usa para rotular ("· 30d", "30d · por idioma
  // y variante"): un rango a mano de una semana salía etiquetado como 30d.
  const daysReales = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400000)
  );
  const storySlug = search.get("storySlug")?.trim() || null;
  const bookSlug = search.get("bookSlug")?.trim() || null;
  const storyIdsForFilter = storySlug ? await resolveStoryIdsForSlug(storySlug) : [];
  const savedStoryFilter = getSavedStoryFilter(storySlug, storyIdsForFilter);
  // Un solo filtro de usuario para TODAS las consultas de abajo: excluye al
  // equipo interno (el usuario + studio team, resueltos via Clerk por su
  // email y cacheados 5 minutos) y aplica la cohorte pedida (todos / beta /
  // publico). NUNCA pongas otra clave `userId` junto a este spread: en un
  // objeto literal gana la ultima y se lleva por delante la exclusion de
  // internos.
  const internalIds = await getInternalUserIds();
  const userScope = await buildMetricsUserScope(cohort, internalIds);
  const cacheKey = JSON.stringify({
    userId,
    section,
    cohort,
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    storySlug,
    bookSlug,
    storyIdsForFilter,
    platform,
    grain,
  });
  const cached = metricsDashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < METRICS_DASHBOARD_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  // Audiobooks pinta las mismas cifras que el Resumen, con el filtro dado la
  // vuelta, así que necesita exactamente los mismos datos.
  // Alertas no tiene datos propios: mira lo que ya calculan el Resumen
  // (tendencia), Contenido (catalogo) y Aprendizaje (sets flojos). Pedir las
  // tres cosas en una peticion es mas barato que tres pestañas abiertas.
  const needsOverviewData =
    section === "overview" || section === "alerts" || esAudiobooks;
  const needsEngagementData = section === "engagement";
  const needsAcquisitionData = section === "acquisition";
  const needsFunnelsData = section === "funnels";
  const needsAudienceData = section === "audience";
  // Contenido no es una sección de eventos, pero su primera tarjeta cuenta
  // cuántas historias y libros distintos se tocaron en el rango, y eso sale
  // de los mismos eventos que el Resumen.
  const needsEventData =
    needsOverviewData || needsEngagementData || section === "content";
  const needsProgressData = needsOverviewData;
  const needsActiveUsersData = needsOverviewData;
  const needsSavedCountsData = needsOverviewData || needsEngagementData;
  const needsCheckoutData = needsAcquisitionData || needsFunnelsData;
  const needsJourneyFunnelData = needsFunnelsData;
  const needsReminderFunnelData = needsFunnelsData;
  const needsTrialData = needsFunnelsData;
  const needsSignupData = needsOverviewData || needsAcquisitionData;
  const needsLearningData = section === "learning" || section === "alerts";

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Audience uses a fixed 7-day window for the "active users / 10 min per
  // week" computation, independent of the dashboard `days` filter. The
  // onboarding funnel still respects the user's date range so editorial
  // can see how recent cohorts compare against earlier ones.
  const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Period-over-period window: same length as current range, shifted
  // back by `days`. So if current is [from..to] (30 days), prev is
  // [from - 30d .. from]. The endpoint computes a coarse comparable
  // KPI set so the Resumen view can render deltas on every hero card.
  const periodMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - periodMs);
  const needsPrevData = needsOverviewData;

  const [
    events,
    dauRows,
    wauRows,
    mauRows,
    progressRows,
    activeUsersRows,
    savedStoryRows,
    savedBookRows,
    savedStoriesTotal,
    savedBooksTotal,
    trialFunnelRows,
    recentTrialStartRows,
    recentReminderTapRows,
    recentReminderOpenRows,
    checkoutFunnelRows,
    upgradeCtaRows,
    journeyFunnelRows,
    reminderFunnelRows,
    reminderDestinationRows,
    reminderUserRows,
    signupTotalCount,
    signupLast7dCount,
    signupLast30dCount,
    recentSignupRows,
    onboardingFunnelRows,
    weeklyProgressRows,
    prevPracticeRows,
    prevEvents,
    prevProgressRows,
    prevActiveUsersRows,
    prevSavedStoriesTotal,
    prevSavedBooksTotal,
    practiceRows,
    vocabRows,
  ] =
    await Promise.all([
    needsEventData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["audio_play", "audio_complete"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        bookSlug: true,
        storySlug: true,
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }) : Promise.resolve([]),
    // Filas crudas en vez de un `groupBy`: la tarjeta que sale al pasar el
    // cursor ya no enseña cuántos eventos puso cada uno (un "1 ev" no dice si
    // esa persona escuchó o solo tocó una palabra) sino cuántos minutos de
    // audio lleva, y eso hay que calcularlo sobre el progreso de cada historia.
    // Las dos ventanas son pequeñas por definición: hoy, y los últimos 7 días.
    //
    // `ACTIVITY_EVENT_WHERE` deja fuera los `*_sent`, que los escriben los
    // crons al MANDAR un correo o un empujón; ver `src/lib/metricsActivity.ts`.
    //
    // DAU = día de CALENDARIO en el huso del panel, no las últimas 24 horas.
    // Con la ventana móvil la cifra bajaba sola a media tarde, cuando a alguien
    // se le cumplían las 24 h desde su último evento, y eso no es que se haya
    // ido nadie: es que el reloj se movió.
    needsOverviewData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        ...ACTIVITY_EVENT_WHERE,
        createdAt: { gte: startOfLocalDay(now), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: { userId: true, storySlug: true, eventType: true, value: true, metadata: true, createdAt: true },
      take: 50000,
    }) : Promise.resolve([]),
    // WAU = los siete días de calendario que acaban hoy, hoy incluido.
    needsOverviewData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        ...ACTIVITY_EVENT_WHERE,
        createdAt: { gte: startOfLocalDaysAgo(now, 6), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: { userId: true, storySlug: true, eventType: true, value: true, metadata: true, createdAt: true },
      take: 50000,
    }) : Promise.resolve([]),
    // Quien estuvo activo cada día, que es de donde salen TRES cosas: el MAU
    // de la tarjeta, y las curvas de DAU, WAU y DAU/MAU.
    //
    // La ventana empieza 29 días ANTES del rango elegido, no en el rango. El
    // WAU y el MAU de un día son ventanas móviles hacia atrás, así que sin ese
    // arranque los primeros días de la curva saldrían bajos por no tener
    // pasado que mirar, y eso se lee como una caída que nunca ocurrió.
    needsOverviewData || needsEngagementData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        ...ACTIVITY_EVENT_WHERE,
        createdAt: { gte: startOfLocalDaysAgo(from, 29), lte: to },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: { userId: true, createdAt: true },
      take: 300000,
    }) : Promise.resolve([]),
    needsProgressData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50000,
    }) : Promise.resolve([]),
    needsActiveUsersData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsSavedCountsData ? prisma.libraryStory.groupBy({
      by: ["storyId"],
      where: {
        ...userScope,
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { storyId: "desc" } },
      take: 20,
    }) : Promise.resolve([]),
    needsSavedCountsData ? prisma.libraryBook.groupBy({
      by: ["bookId"],
      where: {
        ...userScope,
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 20,
    }) : Promise.resolve([]),
    needsOverviewData ? prisma.libraryStory.count({
      where: {
        ...userScope,
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsOverviewData ? prisma.libraryBook.count({
      where: {
        ...userScope,
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsTrialData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: {
          in: [
            "trial_started",
            "trial_started_with_pm",
            "trial_day_1_active",
            "trial_converted",
            "trial_canceled",
          ],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsTrialData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: { in: ["trial_started", "trial_started_with_pm"] },
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_TRIAL_STARTS_LIMIT,
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_tapped",
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_REMINDER_TAPS_LIMIT,
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_destination_opened",
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_REMINDER_OPENS_LIMIT,
    }) : Promise.resolve([]),
    needsCheckoutData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: {
          in: ["plans_viewed", "checkout_started", "checkout_redirected", "checkout_failed"],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsFunnelsData ? prisma.userMetric.groupBy({
      by: ["storySlug"],
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        eventType: "upgrade_cta_clicked",
        storySlug: { startsWith: "__upgrade_" },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsJourneyFunnelData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        bookSlug: "journey",
        eventType: {
          in: [
            "journey_variant_selected",
            "journey_level_selected",
            "journey_topic_opened",
            "journey_next_action_clicked",
            "journey_review_cta_clicked",
            "checkpoint_recovery_clicked",
            "practice_recommended_mode_opened",
          ],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: {
          in: ["reminder_scheduled", "reminder_tapped", "reminder_destination_opened"],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_destination_opened",
      },
      select: {
        metadata: true,
      },
      take: 5000,
    }) : Promise.resolve([]),
    // Gente DISTINTA con el recordatorio puesto. `reminder_scheduled` se
    // emite cuando el movil programa el recordatorio, no cuando lo enseña:
    // en 30 dias hay 2 eventos y 22 taps, asi que contarlos como base de un
    // embudo daba un "1000% tap rate". Como personas si dice algo.
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_scheduled",
      },
      select: { userId: true },
      distinct: ["userId"],
    }) : Promise.resolve([]),
    // Signup totals + rolling windows + recent signups list.
    needsSignupData
      ? prisma.userMetric.count({
          where: { ...userScope, eventType: "signup_completed" },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.count({
          where: {
            ...userScope,
            ...platformFilter,
        ...librosFilter,
            eventType: "signup_completed",
            createdAt: { gte: sevenDaysAgo },
          },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.count({
          where: {
            ...userScope,
            ...platformFilter,
        ...librosFilter,
            eventType: "signup_completed",
            createdAt: { gte: thirtyDaysAgo },
          },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.findMany({
          where: { ...userScope, eventType: "signup_completed" },
          select: { userId: true, createdAt: true, metadata: true },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    // Onboarding funnel raw rows. Volume is low (one row per user per
    // event), so we fetch and bucket in memory to get the per-step
    // breakdown from metadata.step that a single groupBy can't express.
    needsAudienceData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        storySlug: "onboarding",
        eventType: {
          in: [
            "onboarding_started",
            "onboarding_step_completed",
            "onboarding_finished",
            "onboarding_abandoned",
            "onboarding_level_test_started",
            "onboarding_level_test_completed",
          ],
        },
      },
      select: {
        eventType: true,
        metadata: true,
      },
      take: 10000,
    }) : Promise.resolve([]),
    // Weekly activity: progress rows over the last 7 days. We compute
    // listened seconds per user (max per user+story to avoid double-counting
    // pause/continue) and bucket users by minutes/week.
    needsAudienceData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: last7DaysStart, lte: now },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
      },
      take: 50000,
    }) : Promise.resolve([]),
    // ── Period-over-period: same shape as `events` but for the
    // previous window. Used to derive `prevKpis` for deltas.
    // Ejercicios de practica del periodo ANTERIOR, para que la tarjeta de
    // "ejercicios por practicante" pueda comparar. Consulta propia porque
    // `prevEvents` solo trae audio.
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: prevFrom, lt: prevTo },
        eventType: "practice_session_completed",
      },
      select: { userId: true, metadata: true },
      take: 50000,
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: prevFrom, lt: prevTo },
        eventType: { in: ["audio_play", "audio_complete"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        bookSlug: true,
        storySlug: true,
        eventType: true,
        createdAt: true,
      },
      take: 20000,
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: prevFrom, lt: prevTo },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
      },
      take: 50000,
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsPrevData ? prisma.libraryStory.count({
      where: {
        ...userScope,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsPrevData ? prisma.libraryBook.count({
      where: {
        ...userScope,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    // ── Aprendizaje. Dos señales, y solo dos, porque son las únicas que
    // la app emite de verdad: sesiones de práctica (con su precisión) y
    // consultas de vocabulario. `journey_topic_checkpoint_complete` no
    // tiene ni una fila y `journey_story_read` se quedó en 5 de mayo de
    // 2026 (lo dispara solo el web), así que no se consultan.
    // También en Resumen y Engagement: de aquí sale "Ejercicios por
    // practicante", el gemelo de "Min por oyente" para la práctica.
    needsLearningData || needsOverviewData || needsEngagementData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["practice_session_started", "practice_session_completed"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        eventType: true,
        metadata: true,
        createdAt: true,
      },
      take: 20000,
    }) : Promise.resolve([]),
    needsLearningData ? prisma.userMetric.findMany({
      where: {
        ...userScope,
        ...platformFilter,
        ...librosFilter,
        createdAt: { gte: from, lte: to },
        eventType: "vocab_clicked",
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        metadata: true,
      },
      take: 50000,
    }) : Promise.resolve([]),
    ]);

  const plays = events.filter((e) => e.eventType === "audio_play").length;
  const completions = events.filter((e) => e.eventType === "audio_complete").length;

  // ── Terminadas sobre empezadas ──
  // Antes esto era `audio_complete` entre `audio_play`, y daba 261%: el lector
  // del móvil manda `story_opened` y `audio_complete` pero NUNCA `audio_play`,
  // así que el numerador contaba las dos superficies y el denominador solo la
  // web. Encima contaba eventos, de modo que volver a oír una historia subía
  // el ritmo sin que nadie terminara nada nuevo.
  //
  // Ahora la unidad es la pareja persona+historia, y "empezada" es cualquier
  // señal sobre ella (abrirla, darle al play o terminarla), que es lo único
  // que las dos superficies emiten igual. Una historia terminada cuenta
  // siempre como empezada, así que el porcentaje no puede pasar de 100.
  const pairKey = (r: { userId: string; storySlug: string }) => `${r.userId}::${r.storySlug}`;
  const slugFilter = {
    ...(storySlug ? { storySlug } : {}),
    ...(bookSlug ? { bookSlug } : {}),
  };
  // `orderBy` + `distinct` devuelve la PRIMERA fila de cada pareja, y con ella
  // el día en que esa persona empezó esa historia. Hace falta para que la
  // curva diaria del completion rate use la misma definición que la tarjeta.
  const [startedPairs, finishedPairs, prevStartedPairs, prevFinishedPairs] = await Promise.all([
    needsEventData ? prisma.userMetric.findMany({
      where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: from, lte: to }, eventType: { in: ["story_opened", "audio_play", "audio_complete"] }, ...slugFilter },
      distinct: ["userId", "storySlug"],
      orderBy: { createdAt: "asc" },
      select: { userId: true, storySlug: true, createdAt: true },
    }) : Promise.resolve([]),
    needsEventData ? prisma.userMetric.findMany({
      where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: from, lte: to }, eventType: "audio_complete", ...slugFilter },
      distinct: ["userId", "storySlug"],
      select: { userId: true, storySlug: true },
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: prevFrom, lte: prevTo }, eventType: { in: ["story_opened", "audio_play", "audio_complete"] }, ...slugFilter },
      distinct: ["userId", "storySlug"],
      select: { userId: true, storySlug: true },
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: prevFrom, lte: prevTo }, eventType: "audio_complete", ...slugFilter },
      distinct: ["userId", "storySlug"],
      select: { userId: true, storySlug: true },
    }) : Promise.resolve([]),
  ]);
  const storiesStarted = new Set(startedPairs.map(pairKey)).size;
  const storiesFinished = new Set(finishedPairs.map(pairKey)).size;
  const completionRate =
    storiesStarted > 0 ? Math.round((storiesFinished / storiesStarted) * 100) : 0;

  const byDay = new Map<string, { plays: number; completions: number }>();
  const byStory = new Map<string, { plays: number; completions: number }>();
  const byBook = new Map<string, { plays: number; completions: number }>();
  const byUserStoryMaxSeconds = new Map<string, number>();
  const byStorySeconds = new Map<string, number>();
  const byStoryListeners = new Map<string, Set<string>>();

  for (const row of events as EventRow[]) {
    const dayKey = toDayKey(row.createdAt);
    const day = byDay.get(dayKey) ?? { plays: 0, completions: 0 };
    const story = byStory.get(row.storySlug) ?? { plays: 0, completions: 0 };

    // OJO: `audio_play` lo emite SOLO el lector web. En los 30 días hasta el
    // 2026-09-23 fueron 238, todos de web, cero de iOS y cero de Android: el
    // móvil emite `story_opened` y `audio_complete` y nunca el play. Por eso
    // la tarjeta se llama "Plays (solo web)": con el selector de plataforma en
    // iOS o Android cae a cero, y sin el nombre se lee como una avería.
    if (row.eventType === "audio_play") {
      day.plays += 1;
      story.plays += 1;
      if (row.bookSlug) {
        const book = byBook.get(row.bookSlug) ?? { plays: 0, completions: 0 };
        book.plays += 1;
        byBook.set(row.bookSlug, book);
      }
    } else if (row.eventType === "audio_complete") {
      day.completions += 1;
      story.completions += 1;
      if (row.bookSlug) {
        const book = byBook.get(row.bookSlug) ?? { plays: 0, completions: 0 };
        book.completions += 1;
        byBook.set(row.bookSlug, book);
      }
    }

    byDay.set(dayKey, day);
    byStory.set(row.storySlug, story);
  }

  // Aggregate listened seconds by taking max progress per user+story in range
  // to avoid over-counting repeated pause/continue events.
  for (const row of progressRows as ProgressRow[]) {
    const value = getProgressValue(row);
    if (!Number.isFinite(value) || value <= 0) continue;
    const key = `${row.userId}::${row.storySlug}`;
    const prev = byUserStoryMaxSeconds.get(key) ?? 0;
    if (value > prev) {
      byUserStoryMaxSeconds.set(key, value);
    }
  }

  for (const [key, seconds] of byUserStoryMaxSeconds.entries()) {
    const [uid, slug] = key.split("::");
    byStorySeconds.set(slug, (byStorySeconds.get(slug) ?? 0) + seconds);
    const listeners = byStoryListeners.get(slug) ?? new Set<string>();
    listeners.add(uid);
    byStoryListeners.set(slug, listeners);
  }

  const totalListenedSeconds = Array.from(byUserStoryMaxSeconds.values()).reduce(
    (sum, seconds) => sum + seconds,
    0
  );
  const totalListenedMinutes = Math.round((totalListenedSeconds / 60) * 10) / 10;
  const activeUsersInRange = (activeUsersRows as Array<{ userId: string }>).length;
  // ── Minutos por OYENTE ──
  // La cifra anterior, `avgMinutesPerActiveUser`, repartía los minutos entre
  // todo el que dio
  // cualquier señal, y la mayoría no reproduce nada: el 23/09 eran 92
  // personas activas contra 52 que le dieron al play, así que 40 tiraban del
  // promedio hacia abajo sin haber escuchado nunca. Mezclado así, la cifra
  // BAJA cuando entra gente que no escucha, que es lo contrario de lo que uno
  // cree estar leyendo. El alcance ya lo cuentan DAU, WAU y Active users; esta
  // se queda solo con la profundidad.
  const listeners = new Set(
    Array.from(byUserStoryMaxSeconds.keys()).map((key) => key.split("::")[0])
  ).size;
  const minutesPerListener =
    listeners > 0
      ? Math.round(((totalListenedSeconds / listeners) / 60) * 10) / 10
      : 0;

  // ── Ejercicios por PRACTICANTE ──
  // El gemelo de "Min por oyente" en la otra mitad del producto. Mismo
  // criterio: el denominador es quien de verdad practicó, no todo el que dio
  // cualquier señal, para que la cifra no baje cuando entra gente que ni abre
  // la práctica. El numerador son los ejercicios (`itemsCount` de cada sesión
  // terminada), no las sesiones, porque una sesión de diez no es una de tres.
  const ejerciciosPorPersona = new Map<string, number>();
  const ejerciciosPorDia = new Map<string, Map<string, number>>();
  for (const row of practiceRows as Array<{
    userId: string;
    eventType: string;
    metadata: unknown;
    createdAt: Date;
  }>) {
    if (row.eventType !== "practice_session_completed") continue;
    const meta = row.metadata as { itemsCount?: unknown } | null;
    const items = typeof meta?.itemsCount === "number" ? meta.itemsCount : 0;
    if (items <= 0) continue;
    ejerciciosPorPersona.set(
      row.userId,
      (ejerciciosPorPersona.get(row.userId) ?? 0) + items
    );
    const dayKey = toDayKey(row.createdAt);
    const delDia = ejerciciosPorDia.get(dayKey) ?? new Map<string, number>();
    delDia.set(row.userId, (delDia.get(row.userId) ?? 0) + items);
    ejerciciosPorDia.set(dayKey, delDia);
  }
  const practitioners = ejerciciosPorPersona.size;
  const totalExercises = Array.from(ejerciciosPorPersona.values()).reduce(
    (sum, n) => sum + n,
    0
  );
  const exercisesPerPractitioner =
    practitioners > 0
      ? Math.round((totalExercises / practitioners) * 10) / 10
      : 0;

  // ── Completion rate DIARIO, con la definición de la tarjeta ──
  // Antes era `audio_complete` entre `audio_play` del mismo día natural, y por
  // eso el 11/09 salía 178%: una historia empezada la víspera y terminada ese
  // día suma arriba sin sumar abajo. Ahora la unidad es la pareja
  // persona+historia, igual que en la tarjeta, y cada pareja se apunta al día
  // en que EMPEZÓ, también cuando se terminó más tarde. Así el numerador es
  // siempre un subconjunto del denominador y la curva no puede pasar de 100.
  const finishedKeys = new Set(finishedPairs.map(pairKey));
  const byDayPairs = new Map<string, { started: number; finished: number }>();
  for (const r of startedPairs as { userId: string; storySlug: string; createdAt: Date }[]) {
    const dayKey = toDayKey(r.createdAt);
    const d = byDayPairs.get(dayKey) ?? { started: 0, finished: 0 };
    d.started += 1;
    if (finishedKeys.has(pairKey(r))) d.finished += 1;
    byDayPairs.set(dayKey, d);
  }

  // ── Minutos y gente activa por día, para la curva de Avg min/user ──
  // Los minutos del rango se calculan con el punto MÁS LEJANO por
  // persona+historia; aquí se hace lo mismo pero dentro de cada día, que es lo
  // único que se puede repartir en una curva sin contar dos veces a quien
  // retrocede y reescucha.
  const secondsByDay = new Map<string, Map<string, number>>();
  for (const row of progressRows as ProgressRow[]) {
    if (!row.createdAt) continue;
    const value = getProgressValue(row);
    if (!Number.isFinite(value) || value <= 0) continue;
    const dayKey = toDayKey(row.createdAt);
    const perPair = secondsByDay.get(dayKey) ?? new Map<string, number>();
    const key = `${row.userId}::${row.storySlug}`;
    if (value > (perPair.get(key) ?? 0)) perPair.set(key, value);
    secondsByDay.set(dayKey, perPair);
  }

  // ── Quien estuvo activo cada día ──
  // De aquí salen las curvas de DAU, WAU y DAU/MAU. Hasta hoy esas tres
  // tarjetas dibujaban la de reproducciones por día, que es otra cosa: el
  // sparkline pequeño lo disimulaba y el globo grande, con fechas y valores,
  // lo dejaba en evidencia.
  const actividadPorDia = new Map<string, Set<string>>();
  for (const f of mauRows as Array<{ userId: string; createdAt: Date }>) {
    const clave = toDayKey(f.createdAt);
    const set = actividadPorDia.get(clave) ?? new Set<string>();
    set.add(f.userId);
    actividadPorDia.set(clave, set);
  }
  /**
   * Personas distintas en la ventana de `dias` que TERMINA en ese día, él
   * incluido. Se retrocede con `startOfLocalDaysAgo` y no restando 24 h,
   * porque el día que cambia la hora no dura 24 h y restar milisegundos
   * saltaría o repetiría una jornada.
   */
  const unicosHasta = (fin: Date, dias: number): number => {
    const set = new Set<string>();
    for (let i = 0; i < dias; i++) {
      for (const u of actividadPorDia.get(toDayKey(startOfLocalDaysAgo(fin, i))) ?? []) {
        set.add(u);
      }
    }
    return set.size;
  };

  // Una fila por CADA día del rango, no solo por los que tuvieron eventos.
  // Antes las filas salían de la unión de las llaves con datos, así que un
  // rango de 180 días daba 67 puntos y la curva se comía los ceros: dos días
  // flojos separados por una semana muerta salían pegados, como si nada
  // hubiera pasado en medio.
  const diasDelRango = Math.max(
    1,
    Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86400000) + 1
  );
  const allDays: string[] = [];
  for (let i = diasDelRango - 1; i >= 0; i--) {
    allDays.push(toDayKey(startOfLocalDaysAgo(to, i)));
  }
  const dailyPorDia = allDays
    .map((date) => {
      const v = byDay.get(date) ?? { plays: 0, completions: 0 };
      const pares = byDayPairs.get(date);
      const segundos = Array.from(secondsByDay.get(date)?.values() ?? []).reduce(
        (sum, sec) => sum + sec,
        0
      );
      const oyentes = new Set(
        Array.from(secondsByDay.get(date)?.keys() ?? []).map(
          (key) => key.split("::")[0]
        )
      ).size;
      // Mediodía UTC: cualquier hora vale para identificar el día, y las 12
      // no se cae al otro lado en ningún huso ni cuando cambia la hora.
      const finDelDia = new Date(`${date}T12:00:00Z`);
      return {
        date,
        plays: v.plays,
        completions: v.completions,
        completionRate:
          pares && pares.started > 0
            ? Math.round((pares.finished / pares.started) * 100)
            : 0,
        minutesPerListener:
          oyentes > 0 ? Math.round((segundos / oyentes / 60) * 10) / 10 : 0,
        activeUsers: actividadPorDia.get(date)?.size ?? 0,
        wau: unicosHasta(finDelDia, 7),
        dauMauPct: (() => {
          const dau = actividadPorDia.get(date)?.size ?? 0;
          const mauDia = unicosHasta(finDelDia, 30);
          return mauDia > 0 ? Math.round((dau / mauDia) * 1000) / 10 : 0;
        })(),
        listenedMinutes: Math.round((segundos / 60) * 10) / 10,
        exercisesPerPractitioner: (() => {
          const delDia = ejerciciosPorDia.get(date);
          if (!delDia || delDia.size === 0) return 0;
          const total = Array.from(delDia.values()).reduce((sum, n) => sum + n, 0);
          return Math.round((total / delDia.size) * 10) / 10;
        })(),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  /**
   * El mismo material, agrupado por semana cuando el selector lo pide.
   *
   * Se rehace desde los mapas crudos, NO desde las filas diarias, y por dos
   * razones distintas:
   *
   * 1. Las razones no se promedian. Un día con 1 de 1 y otro con 0 de 30 no
   *    dan 50%. La semana se calcula desde sus dos lados: terminadas entre
   *    empezadas, minutos entre oyentes, ejercicios entre practicantes.
   * 2. Las personas distintas no se suman. Quien entra los siete días es UNA
   *    persona en la semana, no siete, así que hay que volver a unir los
   *    conjuntos en vez de sumar los tamaños.
   */
  const lunesDe = (dia: string): string => {
    const d = new Date(`${dia}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const daily =
    grain === "week"
      ? (() => {
          const semanas = new Map<string, string[]>();
          for (const dia of allDays) {
            const clave = lunesDe(dia);
            semanas.set(clave, [...(semanas.get(clave) ?? []), dia]);
          }
          return Array.from(semanas.entries())
            .map(([date, dias]) => {
              let plays = 0;
              let completions = 0;
              let empezadas = 0;
              let terminadas = 0;
              const oyentes = new Set<string>();
              const activos = new Set<string>();
              const practicantes = new Set<string>();
              let segundos = 0;
              let ejercicios = 0;
              for (const dia of dias) {
                const v = byDay.get(dia);
                plays += v?.plays ?? 0;
                completions += v?.completions ?? 0;
                const pares = byDayPairs.get(dia);
                empezadas += pares?.started ?? 0;
                terminadas += pares?.finished ?? 0;
                for (const [clave, sec] of secondsByDay.get(dia) ?? []) {
                  segundos += sec;
                  oyentes.add(clave.split("::")[0]);
                }
                for (const u of actividadPorDia.get(dia) ?? []) activos.add(u);
                for (const [u, n] of ejerciciosPorDia.get(dia) ?? []) {
                  ejercicios += n;
                  practicantes.add(u);
                }
              }
              const ultimo = dias[dias.length - 1];
              const minutos = Math.round((segundos / 60) * 10) / 10;
              return {
                date,
                plays,
                completions,
                completionRate:
                  empezadas > 0 ? Math.round((terminadas / empezadas) * 100) : 0,
                minutesPerListener:
                  oyentes.size > 0
                    ? Math.round((segundos / oyentes.size / 60) * 10) / 10
                    : 0,
                exercisesPerPractitioner:
                  practicantes.size > 0
                    ? Math.round((ejercicios / practicantes.size) * 10) / 10
                    : 0,
                // Personas distintas de la semana entera, no del último día.
                activeUsers: activos.size,
                // El WAU y el DAU/MAU ya son ventanas móviles: su valor
                // semanal es el del último día, que es el que mira los siete.
                wau: unicosHasta(new Date(`${ultimo}T12:00:00Z`), 7),
                dauMauPct: (() => {
                  const fin = new Date(`${ultimo}T12:00:00Z`);
                  const mauDia = unicosHasta(fin, 30);
                  return mauDia > 0
                    ? Math.round((activos.size / mauDia) * 1000) / 10
                    : 0;
                })(),
                listenedMinutes: minutos,
              };
            })
            .sort((a, b) => a.date.localeCompare(b.date));
        })()
      : dailyPorDia;

  // ── Reparto por idioma y variante ──
  // El idioma NO sale del evento. `metadata.language` solo lo emite el móvil,
  // así que 41 usuarios de web quedaban sin clasificar; sale de la historia,
  // cruzando `storySlug` con `JourneyStory -> Journey`.
  //
  // La unidad es la pareja persona+historia, la misma que el completion rate
  // de la tarjeta, para que las dos cifras se puedan leer juntas.
  //
  // El corte llega hasta la VARIANTE y no se queda en el idioma: español es
  // latam, España, Colombia y México, y agrupar los cuatro borraría justo la
  // diferencia que decide qué journey se escribe.
  const slugsVistos = Array.from(
    new Set([
      ...startedPairs.map((r) => r.storySlug),
      ...Array.from(byUserStoryMaxSeconds.keys()).map((k) => k.split("::")[1]),
    ])
  ).filter(Boolean);
  const historiasDeJourney = needsOverviewData && slugsVistos.length > 0
    ? await prisma.journeyStory.findMany({
        where: { slug: { in: slugsVistos } },
        select: {
          slug: true,
          journey: { select: { language: true, variant: true, name: true } },
        },
      })
    : [];
  const journeyDeSlug = new Map(
    historiasDeJourney
      .filter((h) => h.journey)
      .map((h) => [h.slug, h.journey!])
  );
  type FilaIdioma = {
    language: string;
    variant: string;
    users: number;
    started: number;
    finished: number;
    completionRate: number;
    minutes: number;
  };
  const acumIdioma = new Map<
    string,
    { language: string; variant: string; users: Set<string>; started: number; finished: number; seconds: number }
  >();
  const deIdioma = (clave: string, language: string, variant: string) => {
    const fila = acumIdioma.get(clave) ?? {
      language,
      variant,
      users: new Set<string>(),
      started: 0,
      finished: 0,
      seconds: 0,
    };
    acumIdioma.set(clave, fila);
    return fila;
  };
  // Las historias que no son de un journey van a su propia fila en vez de
  // desaparecer: si no, la suma del panel no cuadraría con el total y no
  // habría forma de saber por qué. Comprobado el 2026-09-23: TODAS tienen
  // `bookSlug`, son los siete libros del catálogo y nada más, así que la fila
  // se llama por lo que es.
  const SIN_JOURNEY = "__sin_journey__";
  for (const par of startedPairs as Array<{ userId: string; storySlug: string }>) {
    const j = journeyDeSlug.get(par.storySlug);
    const clave = j ? `${j.language}/${j.variant}` : SIN_JOURNEY;
    const fila = deIdioma(clave, j?.language ?? "libros", j?.variant ?? "");
    fila.users.add(par.userId);
    fila.started += 1;
    if (finishedKeys.has(pairKey(par))) fila.finished += 1;
  }
  for (const [clave, segundos] of byUserStoryMaxSeconds.entries()) {
    const slug = clave.split("::")[1];
    const j = journeyDeSlug.get(slug);
    const k = j ? `${j.language}/${j.variant}` : SIN_JOURNEY;
    deIdioma(k, j?.language ?? "libros", j?.variant ?? "").seconds += segundos;
  }
  // ── Reparto por LIBRO ──
  // El de idioma agrupa por journey, que un audiolibro no tiene. Aquí la
  // unidad es el `bookSlug`, que en las filas de libro sí es fiable.
  const acumLibro = new Map<
    string,
    { users: Set<string>; started: number; finished: number; seconds: number }
  >();
  if (esAudiobooks) {
    const libroDeSlug = new Map<string, string>();
    for (const row of events as EventRow[]) {
      if (row.bookSlug) libroDeSlug.set(row.storySlug, row.bookSlug);
    }
    const deLibro = (slug: string) => libroDeSlug.get(slug) ?? "(sin libro)";
    for (const par of startedPairs as Array<{ userId: string; storySlug: string }>) {
      const k = deLibro(par.storySlug);
      const f = acumLibro.get(k) ?? { users: new Set<string>(), started: 0, finished: 0, seconds: 0 };
      f.users.add(par.userId);
      f.started += 1;
      if (finishedKeys.has(pairKey(par))) f.finished += 1;
      acumLibro.set(k, f);
    }
    for (const [clave, segundos] of byUserStoryMaxSeconds.entries()) {
      const k = deLibro(clave.split("::")[1]);
      const f = acumLibro.get(k) ?? { users: new Set<string>(), started: 0, finished: 0, seconds: 0 };
      f.seconds += segundos;
      acumLibro.set(k, f);
    }
  }
  const audiobookSplit = Array.from(acumLibro.entries())
    .map(([book, f]) => ({
      book,
      users: f.users.size,
      started: f.started,
      finished: f.finished,
      completionRate: f.started > 0 ? Math.round((f.finished / f.started) * 100) : 0,
      minutes: Math.round((f.seconds / 60) * 10) / 10,
    }))
    .sort((a, b) => b.users - a.users || b.minutes - a.minutes);

  const languageSplit: FilaIdioma[] = Array.from(acumIdioma.values())
    .map((f) => ({
      language: f.language,
      variant: f.variant,
      users: f.users.size,
      started: f.started,
      finished: f.finished,
      completionRate: f.started > 0 ? Math.round((f.finished / f.started) * 100) : 0,
      minutes: Math.round((f.seconds / 60) * 10) / 10,
    }))
    .sort((a, b) => b.users - a.users || b.minutes - a.minutes);

  const topStories = Array.from(byStory.entries())
    .map(([slug, v]) => ({
      storySlug: slug,
      plays: v.plays,
      completions: v.completions,
      completionRate: v.plays > 0 ? Math.round((v.completions / v.plays) * 100) : 0,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topBooks = Array.from(byBook.entries())
    .map(([slug, v]) => ({
      bookSlug: slug,
      plays: v.plays,
      completions: v.completions,
      completionRate: v.plays > 0 ? Math.round((v.completions / v.plays) * 100) : 0,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topStoriesByMinutesPre = Array.from(byStorySeconds.entries())
    .map(([storySlugValue, listenedSeconds]) => ({
      storySlug: storySlugValue,
      listenedMinutes: Math.round((listenedSeconds / 60) * 10) / 10,
      listeners: byStoryListeners.get(storySlugValue)?.size ?? 0,
    }))
    .sort((a, b) => b.listenedMinutes - a.listenedMinutes)
    .slice(0, 10);
  const storyLanguageMap =
    topStoriesByMinutesPre.length > 0
      ? await resolveStoryLanguageMap(topStoriesByMinutesPre.map((s) => s.storySlug))
      : new Map<string, string>();
  const topStoriesByMinutes = topStoriesByMinutesPre.map((s) => ({
    ...s,
    language: storyLanguageMap.get(s.storySlug) ?? null,
  }));

  const savedStorySlugMap = needsSavedCountsData
    ? await resolveStorySlugMap((savedStoryRows as SavedStoryRow[]).map((row) => row.storyId))
    : new Map<string, string>();
  const topSavedStories = (savedStoryRows as SavedStoryRow[])
    .map((row) => ({
      storySlug: savedStorySlugMap.get(row.storyId) ?? row.storyId,
      saves: row._count._all,
    }))
    .slice(0, 10);

  // Resolve raw bookIds (Stripe-style product codes) to display titles
  // pulled from LibraryBook.title so the dashboard shows "Colombian
  // Spanish Stories for Beginners" instead of "DP-COLOMBIAN-...".
  const bookTitleMap = needsSavedCountsData
    ? await resolveBookTitleMap((savedBookRows as SavedBookRow[]).map((row) => row.bookId))
    : new Map<string, string>();
  const topSavedBooks = (savedBookRows as SavedBookRow[])
    .map((row) => ({
      bookSlug: bookTitleMap.get(row.bookId) ?? row.bookId,
      saves: row._count._all,
    }))
    .slice(0, 10);

  const savedStories = savedStoriesTotal;
  const savedBooks = savedBooksTotal;

  const trialCounts = {
    started: 0,
    startedWithPm: 0,
    day1Active: 0,
    converted: 0,
    canceled: 0,
  };
  for (const row of trialFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "trial_started") trialCounts.started = row._count._all;
    if (row.eventType === "trial_started_with_pm") trialCounts.startedWithPm = row._count._all;
    if (row.eventType === "trial_day_1_active") trialCounts.day1Active = row._count._all;
    if (row.eventType === "trial_converted") trialCounts.converted = row._count._all;
    if (row.eventType === "trial_canceled") trialCounts.canceled = row._count._all;
  }
  const conversionRate =
    trialCounts.started > 0 ? Math.round((trialCounts.converted / trialCounts.started) * 100) : 0;
  const day1ActivationRate =
    trialCounts.started > 0 ? Math.round((trialCounts.day1Active / trialCounts.started) * 100) : 0;
  const cancelRate =
    trialCounts.started > 0 ? Math.round((trialCounts.canceled / trialCounts.started) * 100) : 0;
  const trialStartUserEmails = needsTrialData
    ? await resolveUserEmails((recentTrialStartRows as TrialStartRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentTrialStarts = (recentTrialStartRows as TrialStartRow[]).map((row) => ({
    userId: row.userId,
    email: trialStartUserEmails.get(row.userId) ?? null,
    eventType: row.eventType,
    createdAt: row.createdAt.toISOString(),
  }));

  type SignupRow = {
    userId: string;
    createdAt: Date;
    metadata: unknown;
  };
  const signupRows = recentSignupRows as SignupRow[];
  const signupEmails = needsSignupData
    ? await resolveUserEmails(signupRows.map((row) => row.userId))
    : new Map<string, string | null>();
  const recentSignups = signupRows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const metaEmail = typeof meta?.email === "string" ? meta.email : null;
    return {
      userId: row.userId,
      email: signupEmails.get(row.userId) ?? metaEmail,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const reminderTapUserEmails = needsReminderFunnelData
    ? await resolveUserEmails((recentReminderTapRows as ReminderTapRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentReminderTaps = (recentReminderTapRows as ReminderTapRow[]).map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
    return {
      userId: row.userId,
      email: reminderTapUserEmails.get(row.userId) ?? null,
      eventType: row.eventType,
      destination: typeof metadata?.targetKind === "string" ? metadata.targetKind : null,
      source: typeof metadata?.source === "string" ? metadata.source : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const reminderOpenUserEmails = needsReminderFunnelData
    ? await resolveUserEmails((recentReminderOpenRows as ReminderTapRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentReminderOpens = (recentReminderOpenRows as ReminderTapRow[]).map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
    return {
      userId: row.userId,
      email: reminderOpenUserEmails.get(row.userId) ?? null,
      eventType: row.eventType,
      destination: typeof metadata?.targetKind === "string" ? metadata.targetKind : null,
      createdAt: row.createdAt.toISOString(),
    };
  });

  const checkoutCounts = {
    plansViewed: 0,
    checkoutStarted: 0,
    checkoutRedirected: 0,
    checkoutFailed: 0,
  };
  for (const row of checkoutFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "plans_viewed") checkoutCounts.plansViewed = row._count._all;
    if (row.eventType === "checkout_started") checkoutCounts.checkoutStarted = row._count._all;
    if (row.eventType === "checkout_redirected") checkoutCounts.checkoutRedirected = row._count._all;
    if (row.eventType === "checkout_failed") checkoutCounts.checkoutFailed = row._count._all;
  }
  const checkoutStartRate =
    checkoutCounts.plansViewed > 0
      ? Math.round((checkoutCounts.checkoutStarted / checkoutCounts.plansViewed) * 100)
      : 0;
  const checkoutRedirectRate =
    checkoutCounts.checkoutStarted > 0
      ? Math.round((checkoutCounts.checkoutRedirected / checkoutCounts.checkoutStarted) * 100)
      : 0;

  const upgradeCtaSources = (
    upgradeCtaRows as Array<{ storySlug: string; _count: { _all: number } }>
  )
    .map((row) => ({
      source: row.storySlug.replace("__upgrade_", "").replace(/__$/, ""),
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const journeyCounts = {
    variantSelected: 0,
    levelSelected: 0,
    topicOpened: 0,
    nextActionClicked: 0,
    reviewCtaClicked: 0,
    checkpointRecoveryClicked: 0,
    recommendedModeOpened: 0,
  };
  for (const row of journeyFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "journey_variant_selected") journeyCounts.variantSelected = row._count._all;
    if (row.eventType === "journey_level_selected") journeyCounts.levelSelected = row._count._all;
    if (row.eventType === "journey_topic_opened") journeyCounts.topicOpened = row._count._all;
    if (row.eventType === "journey_next_action_clicked") journeyCounts.nextActionClicked = row._count._all;
    if (row.eventType === "journey_review_cta_clicked") journeyCounts.reviewCtaClicked = row._count._all;
    if (row.eventType === "checkpoint_recovery_clicked") journeyCounts.checkpointRecoveryClicked = row._count._all;
    if (row.eventType === "practice_recommended_mode_opened") {
      journeyCounts.recommendedModeOpened = row._count._all;
    }
  }

  const reminderCounts = {
    scheduled: 0,
    tapped: 0,
    destinationOpened: 0,
  };
  for (const row of reminderFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "reminder_scheduled") reminderCounts.scheduled = row._count._all;
    if (row.eventType === "reminder_tapped") reminderCounts.tapped = row._count._all;
    if (row.eventType === "reminder_destination_opened") reminderCounts.destinationOpened = row._count._all;
  }
  const reminderDestinationMap = new Map<string, number>();
  for (const row of reminderDestinationRows as Array<{ metadata: unknown }>) {
    if (!row.metadata || typeof row.metadata !== "object") continue;
    const metadata = row.metadata as Record<string, unknown>;
    const destination =
      typeof metadata.targetKind === "string" && metadata.targetKind.trim().length > 0
        ? metadata.targetKind.trim()
        : "unknown";
    reminderDestinationMap.set(destination, (reminderDestinationMap.get(destination) ?? 0) + 1);
  }
  const reminderDestinationBreakdown = Array.from(reminderDestinationMap.entries())
    .map(([destination, opens]) => ({ destination, opens }))
    .sort((a, b) => b.opens - a.opens || a.destination.localeCompare(b.destination));

  // ── Audience: onboarding funnel ──
  // We count each event type, then derive per-step completions by reading
  // metadata.step on `onboarding_step_completed` rows. Step 4 is implicit
  // in `onboarding_finished`, so we never look for step=4 here.
  const onboardingCounts = {
    started: 0,
    step1Completed: 0,
    step2Completed: 0,
    step3Completed: 0,
    finished: 0,
    abandoned: 0,
    levelTestStarted: 0,
    levelTestCompleted: 0,
  };
  for (const row of onboardingFunnelRows as Array<{
    eventType: string;
    metadata: unknown;
  }>) {
    switch (row.eventType) {
      case "onboarding_started":
        onboardingCounts.started += 1;
        break;
      case "onboarding_finished":
        onboardingCounts.finished += 1;
        break;
      case "onboarding_abandoned":
        onboardingCounts.abandoned += 1;
        break;
      case "onboarding_level_test_started":
        onboardingCounts.levelTestStarted += 1;
        break;
      case "onboarding_level_test_completed":
        onboardingCounts.levelTestCompleted += 1;
        break;
      case "onboarding_step_completed": {
        const meta =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null;
        const step = typeof meta?.step === "number" ? meta.step : null;
        if (step === 1) onboardingCounts.step1Completed += 1;
        else if (step === 2) onboardingCounts.step2Completed += 1;
        else if (step === 3) onboardingCounts.step3Completed += 1;
        break;
      }
      default:
        break;
    }
  }
  const pct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;

  // ── Audience: weekly activity distribution ──
  // Sum max-listened-seconds per user across all stories in the last
  // 7 days, then bucket users by minutes/week. This is the "activation
  // rate" view that an aggregate minutes-per-listener can't surface.
  const byUserStoryMaxSecondsWeekly = new Map<string, number>();
  for (const row of weeklyProgressRows as ProgressRow[]) {
    const value = getProgressValue(row);
    if (!Number.isFinite(value) || value <= 0) continue;
    const key = `${row.userId}::${row.storySlug}`;
    const prev = byUserStoryMaxSecondsWeekly.get(key) ?? 0;
    if (value > prev) byUserStoryMaxSecondsWeekly.set(key, value);
  }
  const byUserSecondsWeekly = new Map<string, number>();
  for (const [key, seconds] of byUserStoryMaxSecondsWeekly.entries()) {
    const [uid] = key.split("::");
    byUserSecondsWeekly.set(uid, (byUserSecondsWeekly.get(uid) ?? 0) + seconds);
  }
  const weeklyMinutesPerUser = Array.from(byUserSecondsWeekly.values())
    .map((s) => s / 60)
    .sort((a, b) => a - b);
  const activeUsersLast7Days = weeklyMinutesPerUser.length;
  const usersOver5Min = weeklyMinutesPerUser.filter((m) => m >= 5).length;
  const usersOver10Min = weeklyMinutesPerUser.filter((m) => m >= 10).length;
  const usersOver30Min = weeklyMinutesPerUser.filter((m) => m >= 30).length;
  const usersOver60Min = weeklyMinutesPerUser.filter((m) => m >= 60).length;
  const totalWeeklyMinutes = weeklyMinutesPerUser.reduce((sum, m) => sum + m, 0);
  const avgMinutesLast7Days =
    activeUsersLast7Days > 0
      ? Math.round((totalWeeklyMinutes / activeUsersLast7Days) * 10) / 10
      : 0;
  const medianMinutes =
    activeUsersLast7Days > 0
      ? Math.round(
          weeklyMinutesPerUser[Math.floor(activeUsersLast7Days / 2)] * 10
        ) / 10
      : 0;
  // Buckets are mutually exclusive. The "5-10" bucket represents users
  // who reached at least 5 min/week but didn't hit the 10-min threshold.
  const distribution = [
    {
      bucket: "<5 min",
      users: activeUsersLast7Days - usersOver5Min,
    },
    {
      bucket: "5-10 min",
      users: usersOver5Min - usersOver10Min,
    },
    {
      bucket: "10-30 min",
      users: usersOver10Min - usersOver30Min,
    },
    {
      bucket: "30-60 min",
      users: usersOver30Min - usersOver60Min,
    },
    {
      bucket: "60+ min",
      users: usersOver60Min,
    },
  ];

  // ── Period-over-period KPIs ──
  // Build a comparable KPI set from the previous-window queries. We
  // compute the same shape as `kpis` so the client can drive deltas
  // generically. uniqueStories/uniqueBooks are derived from prev events,
  // and avg-minutes/total-minutes from prev progress rows.
  let prevKpisPayload: DashboardResponse["prevKpis"] | undefined;
  if (needsPrevData) {
    let prevPlays = 0;
    let prevCompletions = 0;
    const prevByStory = new Set<string>();
    const prevByBook = new Set<string>();
    for (const row of prevEvents as EventRow[]) {
      if (row.eventType === "audio_play") prevPlays += 1;
      else if (row.eventType === "audio_complete") prevCompletions += 1;
      prevByStory.add(row.storySlug);
      if (row.bookSlug) prevByBook.add(row.bookSlug);
    }
    const prevStarted = new Set(prevStartedPairs.map(pairKey)).size;
    const prevFinished = new Set(prevFinishedPairs.map(pairKey)).size;
    const prevCompletionRate =
      prevStarted > 0 ? Math.round((prevFinished / prevStarted) * 100) : 0;
    const prevByUserStoryMaxSeconds = new Map<string, number>();
    for (const row of prevProgressRows as ProgressRow[]) {
      const value = getProgressValue(row);
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = `${row.userId}::${row.storySlug}`;
      const prev = prevByUserStoryMaxSeconds.get(key) ?? 0;
      if (value > prev) prevByUserStoryMaxSeconds.set(key, value);
    }
    const prevTotalListenedSeconds = Array.from(
      prevByUserStoryMaxSeconds.values()
    ).reduce((sum, s) => sum + s, 0);
    const prevActiveUsers = (prevActiveUsersRows as Array<{ userId: string }>).length;
    const prevTotalListenedMinutes =
      Math.round((prevTotalListenedSeconds / 60) * 10) / 10;
    const prevListeners = new Set(
      Array.from(prevByUserStoryMaxSeconds.keys()).map((key) => key.split("::")[0])
    ).size;
    const prevMinutesPerListener =
      prevListeners > 0
        ? Math.round(((prevTotalListenedSeconds / prevListeners) / 60) * 10) / 10
        : 0;
    // DAU, WAU y DAU/MAU llegaban a cero clavado desde que existe la tarjeta:
    // el payload las declaraba y nadie las calculaba, asi que tres de las seis
    // tarjetas del Resumen salian sin comparacion mientras las otras tres si.
    //
    // Su periodo anterior NO es el rango anterior del selector: DAU dice "hoy"
    // y WAU "los ultimos siete dias", asi que lo que toca al lado es ayer y la
    // semana de antes. `actividadPorDia` ya cubre esos dias, porque su ventana
    // es el rango mas 29 dias de arranque.
    const ayer = startOfLocalDaysAgo(now, 1);
    const prevDau = actividadPorDia.get(toDayKey(ayer))?.size ?? 0;
    const prevWau = unicosHasta(startOfLocalDaysAgo(now, 7), 7);
    const prevMau = unicosHasta(ayer, 30);
    const prevEjerciciosPorPersona = new Map<string, number>();
    for (const row of prevPracticeRows as Array<{ userId: string; metadata: unknown }>) {
      const meta = (row.metadata ?? {}) as { itemsCount?: unknown };
      const items = typeof meta.itemsCount === "number" ? meta.itemsCount : 0;
      if (items <= 0) continue;
      prevEjerciciosPorPersona.set(
        row.userId,
        (prevEjerciciosPorPersona.get(row.userId) ?? 0) + items
      );
    }
    const prevPractitioners = prevEjerciciosPorPersona.size;
    prevKpisPayload = {
      dau: prevDau,
      wau: prevWau,
      dauMauPct:
        prevMau > 0 ? Math.round((prevDau / prevMau) * 1000) / 10 : 0,
      exercisesPerPractitioner:
        prevPractitioners > 0
          ? Math.round(
              (Array.from(prevEjerciciosPorPersona.values()).reduce(
                (sum, n) => sum + n,
                0
              ) /
                prevPractitioners) *
                10
            ) / 10
          : 0,
      activeUsersInRange: prevActiveUsers,
      plays: prevPlays,
      completions: prevCompletions,
      completionRate: prevCompletionRate,
      uniqueStories: prevByStory.size,
      uniqueBooks: prevByBook.size,
      minutesPerListener: prevMinutesPerListener,
      listeners: prevListeners,
      totalListenedMinutes: prevTotalListenedMinutes,
      savedStories: prevSavedStoriesTotal as number,
      savedBooks: prevSavedBooksTotal as number,
    };
  }

  // ── Aprendizaje. Las consultas devuelven [] en el resto de secciones,
  // así que esto sale a cero sin coste. La aritmética vive en
  // `src/lib/learningMetrics.ts` para poder verificarla contra la base
  // sin una sesión de Clerk delante.
  const practiceList = practiceRows as LearningPracticeRow[];
  const vocabList = vocabRows as LearningVocabRow[];
  const learningSlugs = Array.from(
    new Set([
      ...practiceList.map((r) => r.storySlug),
      ...vocabList.map((r) => r.storySlug),
    ])
  ).filter(Boolean);
  const [learningLanguageMap, learningLevelMap] = needsLearningData
    ? await Promise.all([
        resolveStoryLanguageMap(
          learningSlugs.filter((s) => !/^journey[-:]/.test(s))
        ),
        resolveStoryLevelMap(learningSlugs),
      ])
    : [new Map<string, string>(), new Map<string, string>()];

  // Solo Engagement los pinta. Van aparte del Promise.all grande porque
  // necesitan cruzar correos (Clerk) antes de poder separar lo de casa.
  const ratingsPayload = needsEngagementData
    ? await computeRatingsMetrics({ userScope, from, to, storySlug, bookSlug })
    : emptyRatingsMetrics();

  const learningPayloadCrudo = computeLearningMetrics({
    practiceRows: practiceList,
    vocabRows: vocabList,
    languageMap: learningLanguageMap,
    levelMap: learningLevelMap,
    normalizeLanguage: normalizeLanguageCode,
  });

  // Los sets flojos vienen con el slug tal cual lo manda la app, y la mitad
  // son la forma `journey-<id>`: el id de una historia de journey viaja en dos
  // formas y esa es una de ellas. Una tabla de trabajo con doce ids no sirve
  // de nada, asi que se traducen a su slug real.
  const learningPayload = await (async () => {
    const pseudo = learningPayloadCrudo.practice.worstSets
      .map((r) => r.storySlug)
      .filter((slug) => slug.startsWith("journey-"));
    if (pseudo.length === 0) return learningPayloadCrudo;
    const historias = await prisma.journeyStory.findMany({
      where: { id: { in: pseudo.map((slug) => slug.slice("journey-".length)) } },
      select: { id: true, slug: true, title: true },
    });
    const porId = new Map(historias.map((h) => [h.id, h.slug ?? h.title ?? null]));
    return {
      ...learningPayloadCrudo,
      practice: {
        ...learningPayloadCrudo.practice,
        worstSets: learningPayloadCrudo.practice.worstSets.map((r) => ({
          ...r,
          storySlug: r.storySlug.startsWith("journey-")
            ? porId.get(r.storySlug.slice("journey-".length)) ?? r.storySlug
            : r.storySlug,
        })),
      },
    };
  })();

  // ── Huecos de glosa ──
  // Palabras que alguien toca en el texto y que NO estan en el vocab de esa
  // historia. Las 25 mas consultadas no llevaban a ninguna accion: la mayoria
  // tienen glosa y que se consulten es exactamente lo que se espera. Esto es
  // lo contrario, y cada fila es una glosa que falta.
  const vocabGaps = needsLearningData && vocabList.length > 0
    ? await (async () => {
        const slugs = [
          ...new Set(
            (vocabList as Array<{ storySlug: string }>)
              .map((r) => r.storySlug)
              .filter(Boolean)
          ),
        ];
        const historias = await prisma.journeyStory.findMany({
          where: {
            OR: [
              { slug: { in: slugs } },
              {
                id: {
                  in: slugs
                    .filter((x) => x.startsWith("journey-"))
                    .map((x) => x.slice("journey-".length)),
                },
              },
            ],
          },
          select: { id: true, slug: true, vocab: true },
        });
        // Se indexa por las DOS formas del id porque las dos llegan en los
        // eventos, y se guardan `word` y `surface`: la glosa existe aunque el
        // lector toque la forma conjugada.
        const porSlug = new Map<string, Set<string>>();
        for (const h of historias) {
          const palabras = new Set(
            (Array.isArray(h.vocab) ? h.vocab : []).flatMap((v) => {
              const o = (v ?? {}) as Record<string, unknown>;
              return [o.word, o.surface]
                .filter((x): x is string => typeof x === "string")
                .map((x) => x.toLowerCase());
            })
          );
          if (h.slug) porSlug.set(h.slug, palabras);
          porSlug.set(`journey-${h.id}`, palabras);
        }

        const agg = new Map<
          string,
          { word: string; storySlug: string; language: string | null; lookups: number; users: Set<string> }
        >();
        for (const row of vocabList as Array<{
          storySlug: string;
          userId: string;
          metadata: unknown;
        }>) {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          const word = typeof meta.word === "string" ? meta.word.toLowerCase() : null;
          if (!word) continue;
          const conocidas = porSlug.get(row.storySlug);
          // Sin vocab conocido no se puede decir que falte: puede ser un libro
          // del catalogo o una historia borrada.
          if (!conocidas || conocidas.has(word)) continue;
          const key = `${row.storySlug}::${word}`;
          const entry = agg.get(key) ?? {
            word,
            storySlug: row.storySlug,
            language: typeof meta.language === "string" ? meta.language : null,
            lookups: 0,
            users: new Set<string>(),
          };
          entry.lookups += 1;
          entry.users.add(row.userId);
          agg.set(key, entry);
        }

        return Array.from(agg.values())
          // Una sola persona puede tropezar con cualquier cosa; dos ya es la
          // palabra y no el lector.
          .filter((r) => r.users.size >= 2)
          .map((r) => ({
            word: r.word,
            storySlug: r.storySlug,
            language: r.language,
            lookups: r.lookups,
            users: r.users.size,
          }))
          .sort((a, b) => b.users - a.users || b.lookups - a.lookups)
          .slice(0, 20);
      })()
    : [];
  learningPayload.vocab.gaps = vocabGaps;


  // ── Quién compone el DAU y el WAU ──
  // Los ids se resuelven contra Clerk una sola vez para los dos conjuntos:
  // el WAU contiene al DAU, así que pedirlos por separado repetiría
  // llamadas. La caché de `resolveUserIdentities` hace el resto.
  type KpiRawRow = {
    userId: string;
    storySlug: string;
    eventType: string;
    value: number | null;
    metadata: unknown;
    createdAt: Date;
  };
  const dauRaw = dauRows as unknown as KpiRawRow[];
  const wauRaw = wauRows as unknown as KpiRawRow[];
  const kpiIdentities = needsOverviewData
    ? await resolveUserIdentities([...wauRaw, ...dauRaw].map((r) => r.userId))
    : new Map<string, { name: string | null; email: string | null; status: MetricsIdentityStatus }>();
  const toKpiUsers = (rows: KpiRawRow[]): MetricsKpiUser[] => {
    type Acc = { events: number; last: Date; minutos: number };
    const porPersona = new Map<string, Acc>();
    // De cada historia cuenta el punto MÁS LEJANO alcanzado, no la suma de los
    // eventos: quien retrocede y reescucha no ha escuchado dos veces. Es el
    // mismo criterio que la tabla por persona de la pestaña Audiencia.
    const masLejano = new Map<string, number>();
    for (const f of rows) {
      const acc = porPersona.get(f.userId) ?? { events: 0, last: f.createdAt, minutos: 0 };
      acc.events += 1;
      if (f.createdAt > acc.last) acc.last = f.createdAt;
      if (isProgressEvent(f.eventType)) {
        const segundos = getProgressValue(f as ProgressRow);
        if (Number.isFinite(segundos) && segundos > 0) {
          const clave = `${f.userId}::${f.storySlug}`;
          if (segundos > (masLejano.get(clave) ?? 0)) masLejano.set(clave, segundos);
        }
      }
      porPersona.set(f.userId, acc);
    }
    for (const [clave, segundos] of masLejano) {
      const acc = porPersona.get(clave.split("::")[0]);
      if (acc) acc.minutos += segundos / 60;
    }
    return Array.from(porPersona.entries())
      .map(([userId, acc]) => {
        const who = kpiIdentities.get(userId);
        return {
          userId,
          name: who?.name ?? null,
          email: who?.email ?? null,
          identityStatus: who?.status ?? "unavailable",
          events: acc.events,
          minutes: Math.round(acc.minutos * 10) / 10,
          lastAt: acc.last.toISOString(),
        };
      })
      // El más reciente arriba: en una lista recortada, quien acaba de dar
      // señal dice más que quien pasó por ahí hace seis días.
      .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  };
  const dauUsers = toKpiUsers(dauRaw);
  const wauUsers = toKpiUsers(wauRaw);

  // ── DAU/MAU ──
  // La vertical se compara con esta razón, no con cohortes: Duolingo publica
  // un 37,2% y es la única cifra de una app de idiomas con definición firme.
  // El numerador es el DAU MEDIO de los treinta días, no el de hoy: con nueve
  // personas activas, un día bueno o un domingo mueven la razón veinte puntos
  // y la tarjeta diría más del calendario que del producto.
  // La ventana de `mauRows` es ancha (el rango más 29 días de arranque), así
  // que aquí se recorta a los TREINTA días que acaban hoy, que es lo que dice
  // la tarjeta. Sin recortar, un rango de 180 días daría un "MAU" de medio
  // año.
  const mauPersonas = new Set<string>();
  const mauPersonaDias = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const clave = toDayKey(startOfLocalDaysAgo(now, i));
    for (const u of actividadPorDia.get(clave) ?? []) {
      mauPersonas.add(u);
      mauPersonaDias.add(`${u}::${clave}`);
    }
  }
  const mau = mauPersonas.size;
  const dauMedio30d = mauPersonaDias.size / 30;
  const dauMauPct = mau > 0 ? Math.round((dauMedio30d / mau) * 1000) / 10 : 0;

  // ── Una fila por persona ──
  // Se calcula sobre filas crudas de las dos ventanas porque cada columna sale
  // de un evento distinto: los minutos del progreso más lejano por historia,
  // los días activos de las fechas, las terminadas de `audio_complete` y las
  // prácticas de `practice_session_completed`. Solo en la pestaña Audiencia.
  type FilaCruda = {
    userId: string;
    storySlug: string;
    eventType: string;
    value: number | null;
    metadata: unknown;
    createdAt: Date;
  };
  const [filasAhora, filasAntes] = needsAudienceData
    ? await Promise.all([
        prisma.userMetric.findMany({
          where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: from, lte: to } },
          select: { userId: true, storySlug: true, eventType: true, value: true, metadata: true, createdAt: true },
          take: 100000,
        }),
        prisma.userMetric.findMany({
          where: { ...userScope, ...platformFilter, ...librosFilter, createdAt: { gte: prevFrom, lte: prevTo } },
          select: { userId: true, storySlug: true, eventType: true, value: true, metadata: true, createdAt: true },
          take: 100000,
        }),
      ])
    : [[] as FilaCruda[], [] as FilaCruda[]];

  type Resumen = {
    minutos: number;
    dias: Set<string>;
    terminadas: Set<string>;
    practicas: number;
    ultimo: Date | null;
  };
  const resumePorPersona = (filas: FilaCruda[]): Map<string, Resumen> => {
    const porPersona = new Map<string, Resumen>();
    // El progreso no se suma tal cual: de cada historia cuenta el punto más
    // lejano alcanzado, igual que en el resto del panel.
    const masLejano = new Map<string, number>();
    for (const f of filas) {
      const r = porPersona.get(f.userId) ?? {
        minutos: 0,
        dias: new Set<string>(),
        terminadas: new Set<string>(),
        practicas: 0,
        ultimo: null,
      };
      r.dias.add(localDayKey(f.createdAt));
      if (!r.ultimo || f.createdAt > r.ultimo) r.ultimo = f.createdAt;
      if (f.eventType === "audio_complete") r.terminadas.add(f.storySlug);
      if (f.eventType === "practice_session_completed") r.practicas += 1;
      if (["audio_pause", "audio_complete", "continue_listening"].includes(f.eventType)) {
        const segundos = getProgressValue(f as ProgressRow);
        if (Number.isFinite(segundos) && segundos > 0) {
          const clave = `${f.userId}::${f.storySlug}`;
          if (segundos > (masLejano.get(clave) ?? 0)) masLejano.set(clave, segundos);
        }
      }
      porPersona.set(f.userId, r);
    }
    for (const [clave, segundos] of masLejano) {
      const userId = clave.split("::")[0];
      const r = porPersona.get(userId);
      if (r) r.minutos += segundos / 60;
    }
    return porPersona;
  };

  const ahora = resumePorPersona(filasAhora as FilaCruda[]);
  const antes = resumePorPersona(filasAntes as FilaCruda[]);
  const identidadesPerUser = needsAudienceData
    ? await resolveUserIdentities(Array.from(ahora.keys()))
    : new Map<string, { name: string | null; email: string | null; status: MetricsIdentityStatus }>();
  const perUser: MetricsPerUserRow[] = Array.from(ahora.entries())
    .map(([userId, r]) => {
      const antesR = antes.get(userId);
      const quien = identidadesPerUser.get(userId);
      return {
        userId,
        name: quien?.name ?? null,
        email: quien?.email ?? null,
        minutes: Math.round(r.minutos * 10) / 10,
        prevMinutes: Math.round((antesR?.minutos ?? 0) * 10) / 10,
        activeDays: r.dias.size,
        prevActiveDays: antesR?.dias.size ?? 0,
        storiesFinished: r.terminadas.size,
        prevStoriesFinished: antesR?.terminadas.size ?? 0,
        practices: r.practicas,
        prevPractices: antesR?.practicas ?? 0,
        lastAt: r.ultimo ? r.ultimo.toISOString() : null,
      };
    })
    .sort((a, b) => b.minutes - a.minutes || b.activeDays - a.activeDays);

  // ── Salud del catalogo publicado ──
  // Contenido media hasta el 2026-09-24 nuestro propio taller (runs de
  // agentes, borradores, throughput). Eso dice como vamos nosotros, no que
  // pasa con lo publicado. Lo que decide trabajo es al reves: que journey
  // vive, que journey no abre nadie, y si alguno salio a produccion con
  // huecos. Hoy los 24 publicados estan completos, asi que las columnas de
  // huecos salen a cero; existen para el dia que no sea asi.
  const catalog = section === "content" || section === "alerts" ? await (async () => {
    const journeys = await prisma.journey.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        language: true,
        variant: true,
        levels: true,
        stories: {
          select: {
            slug: true,
            text: true,
            audioUrl: true,
            practiceSet: { select: { id: true } },
          },
        },
      },
    });

    const slugs = journeys.flatMap((j) =>
      j.stories.map((st) => st.slug).filter((x): x is string => Boolean(x))
    );
    const toques = slugs.length
      ? await prisma.userMetric.findMany({
          where: {
            ...userScope,
            ...platformFilter,
            createdAt: { gte: from, lte: to },
            eventType: { in: ["story_opened", "audio_play", "audio_complete"] },
            storySlug: { in: slugs },
          },
          select: { storySlug: true, userId: true, eventType: true },
        })
      : [];

    const lectoresPorSlug = new Map<string, Set<string>>();
    const terminadaPorSlug = new Set<string>();
    for (const t of toques as Array<{ storySlug: string; userId: string; eventType: string }>) {
      const set = lectoresPorSlug.get(t.storySlug) ?? new Set<string>();
      set.add(t.userId);
      lectoresPorSlug.set(t.storySlug, set);
      if (t.eventType === "audio_complete") terminadaPorSlug.add(t.storySlug);
    }

    const filas = journeys.map((j) => {
      // Una historia "existe" cuando tiene texto: un slot vacio de un journey
      // publicado no es contenido muerto, es contenido que falta.
      const escritas = j.stories.filter((st) => st.text);
      const conSlug = escritas
        .map((st) => st.slug)
        .filter((x): x is string => Boolean(x));
      const lectores = new Set<string>();
      for (const slug of conSlug) {
        for (const u of lectoresPorSlug.get(slug) ?? []) lectores.add(u);
      }
      return {
        id: j.id,
        label: `${j.name} ${j.language}/${j.variant}`,
        levels: j.levels,
        slots: j.stories.length,
        written: escritas.length,
        withoutAudio: escritas.filter((st) => !st.audioUrl).length,
        withoutPractice: escritas.filter((st) => !st.practiceSet).length,
        touched: conSlug.filter((slug) => lectoresPorSlug.has(slug)).length,
        finished: conSlug.filter((slug) => terminadaPorSlug.has(slug)).length,
        readers: lectores.size,
      };
    });

    // De menos tocado a mas: lo primero que hay que mirar es lo que no abre
    // nadie, no lo que ya funciona.
    filas.sort((a, b) => a.touched - b.touched || a.readers - b.readers);

    const written = filas.reduce((n, f) => n + f.written, 0);
    return {
      journeys: filas.length,
      stories: written,
      touchedStories: filas.reduce((n, f) => n + f.touched, 0),
      deadJourneys: filas.filter((f) => f.touched === 0).length,
      storiesWithoutAudio: filas.reduce((n, f) => n + f.withoutAudio, 0),
      storiesWithoutPractice: filas.reduce((n, f) => n + f.withoutPractice, 0),
      emptySlots: filas.reduce((n, f) => n + (f.slots - f.written), 0),
      rows: filas,
    };
  })() : null;

  const payload: DashboardResponse = {
    ...createEmptyDashboardResponse(from, to, daysReales),
    ...(prevKpisPayload
      ? {
          prevRange: {
            from: prevFrom.toISOString(),
            to: prevTo.toISOString(),
            days,
          },
          prevKpis: prevKpisPayload,
        }
      : {}),
    kpiUsers: { dau: dauUsers, wau: wauUsers },
    kpis: {
      dau: dauUsers.length,
      wau: wauUsers.length,
      mau,
      dauMauPct,
      activeUsersInRange,
      plays,
      completions,
      completionRate,
      uniqueStories: byStory.size,
      uniqueBooks: byBook.size,
      minutesPerListener,
      listeners,
      exercisesPerPractitioner,
      practitioners,
      totalListenedMinutes,
      savedStories,
      savedBooks,
      storiesStarted,
      storiesFinished,
    },
    languageSplit,
    audiobookSplit,
    daily,
    topStories,
    topBooks,
    topStoriesByMinutes,
    topSavedStories,
    topSavedBooks,
    signups: {
      total: signupTotalCount as number,
      last7d: signupLast7dCount as number,
      last30d: signupLast30dCount as number,
    },
    recentSignups,
    trialFunnel: {
      started: trialCounts.started,
      startedWithPm: trialCounts.startedWithPm,
      day1Active: trialCounts.day1Active,
      converted: trialCounts.converted,
      canceled: trialCounts.canceled,
      conversionRate,
      day1ActivationRate,
      cancelRate,
    },
    recentTrialStarts,
    recentReminderTaps,
    recentReminderOpens,
    checkoutFunnel: {
      plansViewed: checkoutCounts.plansViewed,
      checkoutStarted: checkoutCounts.checkoutStarted,
      checkoutRedirected: checkoutCounts.checkoutRedirected,
      checkoutFailed: checkoutCounts.checkoutFailed,
      checkoutStartRate,
      checkoutRedirectRate,
    },
    upgradeCtaSources,
    journeyFunnel: {
      ...journeyCounts,
      topicOpenRateFromVariant:
        journeyCounts.variantSelected > 0
          ? Math.round((journeyCounts.topicOpened / journeyCounts.variantSelected) * 100)
          : 0,
      nextActionRateFromTopicOpen:
        journeyCounts.topicOpened > 0
          ? Math.round((journeyCounts.nextActionClicked / journeyCounts.topicOpened) * 100)
          : 0,
      reviewRateFromTopicOpen:
        journeyCounts.topicOpened > 0
          ? Math.round((journeyCounts.reviewCtaClicked / journeyCounts.topicOpened) * 100)
          : 0,
    },
    reminderFunnel: {
      ...reminderCounts,
      usersWithReminder: reminderUserRows.length,
      tapsPerUserWithReminder:
        reminderUserRows.length > 0
          ? Math.round((reminderCounts.tapped / reminderUserRows.length) * 10) / 10
          : 0,
      openRateFromTap:
        reminderCounts.tapped > 0
          ? Math.round((reminderCounts.destinationOpened / reminderCounts.tapped) * 100)
          : 0,
      destinationBreakdown: reminderDestinationBreakdown,
    },
    audience: {
      onboardingFunnel: {
        ...onboardingCounts,
        step1Rate: pct(onboardingCounts.step1Completed, onboardingCounts.started),
        step2Rate: pct(onboardingCounts.step2Completed, onboardingCounts.started),
        step3Rate: pct(onboardingCounts.step3Completed, onboardingCounts.started),
        finishRate: pct(onboardingCounts.finished, onboardingCounts.started),
        levelTestCompleteRate: pct(
          onboardingCounts.levelTestCompleted,
          onboardingCounts.levelTestStarted
        ),
      },
      weeklyActivity: {
        activeUsersLast7Days,
        usersOver5Min,
        usersOver10Min,
        usersOver30Min,
        usersOver60Min,
        activationRate10MinPct: pct(usersOver10Min, activeUsersLast7Days),
        medianMinutes,
        avgMinutesLast7Days,
        distribution,
      },
      perUser,
    },
    learning: learningPayload,
    ratings: ratingsPayload,
    catalog,
  };

  metricsDashboardCache.set(cacheKey, {
    createdAt: Date.now(),
    payload,
  });
  return NextResponse.json(payload);
}
