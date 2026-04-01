/**
 * Content Directive — the high-level "vision" that drives the pipeline.
 *
 * Example: "Este mes, contenido en italiano, niveles A1-B2, temas viaje y cultura."
 *
 * Stored in StudioConfig under key "content_directive".
 * The pipeline reads this automatically on each run.
 */

export type PipelineBudget = {
  /** Max stories to generate per pipeline run */
  maxStoriesPerRun: number;
  /** Hard cap on LLM API calls per run (generation + QA + retries) */
  maxLLMCallsPerRun: number;
  /** Max regeneration attempts per story when QA fails */
  maxRetriesPerStory: number;
  /** Whether to run LLM-based quality checks (narrative, CEFR compliance, etc.) */
  enableLLMQA: boolean;
  /** Whether to auto-retry stories that fail QA */
  autoRetryQA: boolean;
  /** Minimum QA score (0-100) to auto-promote a draft */
  minQAScore: number;
  /** Max pipeline run duration in minutes — hard timeout */
  maxRunDurationMinutes: number;
};

export const DEFAULT_BUDGET: PipelineBudget = {
  maxStoriesPerRun: 10,
  maxLLMCallsPerRun: 50,
  maxRetriesPerStory: 2,
  enableLLMQA: true,
  autoRetryQA: true,
  minQAScore: 85,
  maxRunDurationMinutes: 15,
};

export type ContentDirective = {
  /** Target languages for content generation (e.g. ["it", "pt"]) */
  languages: string[];
  /** Target CEFR levels (e.g. ["a1", "a2", "b1", "b2"]) */
  levels: string[];
  /** Priority topics — empty means all topics (e.g. ["viajes", "cultura"]) */
  topics: string[];
  /** Stories to generate per language+level+topic combination */
  storiesPerSlot: number;
  /** Free-text note from the director (shown in Studio) */
  note: string;
  /** Whether the pipeline should run automatically with this directive */
  active: boolean;
  /** Who last updated this directive */
  updatedBy: string;
  /** When it was last updated */
  updatedAt: string;
  /** Pipeline budget and limits */
  budget: PipelineBudget;
};

export const DEFAULT_DIRECTIVE: ContentDirective = {
  languages: ["es"],
  levels: ["a1", "a2", "b1", "b2"],
  topics: [],
  storiesPerSlot: 4,
  note: "",
  active: true,
  updatedBy: "",
  updatedAt: new Date().toISOString(),
  budget: DEFAULT_BUDGET,
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(val)));
}

const CONFIG_KEY = "content_directive";
const CACHE_TTL = 60_000;

let cached: ContentDirective | null = null;
let cachedAt = 0;

export function sanitizeDirective(raw: unknown): ContentDirective {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const languages = Array.isArray(input.languages)
    ? input.languages.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().toLowerCase())
    : DEFAULT_DIRECTIVE.languages;

  const levels = Array.isArray(input.levels)
    ? input.levels.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().toLowerCase())
    : DEFAULT_DIRECTIVE.levels;

  const topics = Array.isArray(input.topics)
    ? input.topics.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().toLowerCase())
    : DEFAULT_DIRECTIVE.topics;

  const storiesPerSlot =
    typeof input.storiesPerSlot === "number" && input.storiesPerSlot >= 1
      ? Math.floor(input.storiesPerSlot)
      : DEFAULT_DIRECTIVE.storiesPerSlot;

  const rawBudget = input.budget && typeof input.budget === "object"
    ? (input.budget as Record<string, unknown>)
    : {};

  const budget: PipelineBudget = {
    maxStoriesPerRun: clampInt(rawBudget.maxStoriesPerRun, 1, 100, DEFAULT_BUDGET.maxStoriesPerRun),
    maxLLMCallsPerRun: clampInt(rawBudget.maxLLMCallsPerRun, 1, 500, DEFAULT_BUDGET.maxLLMCallsPerRun),
    maxRetriesPerStory: clampInt(rawBudget.maxRetriesPerStory, 0, 5, DEFAULT_BUDGET.maxRetriesPerStory),
    enableLLMQA: typeof rawBudget.enableLLMQA === "boolean" ? rawBudget.enableLLMQA : DEFAULT_BUDGET.enableLLMQA,
    autoRetryQA: typeof rawBudget.autoRetryQA === "boolean" ? rawBudget.autoRetryQA : DEFAULT_BUDGET.autoRetryQA,
    minQAScore: clampInt(rawBudget.minQAScore, 0, 100, DEFAULT_BUDGET.minQAScore),
    maxRunDurationMinutes: clampInt(rawBudget.maxRunDurationMinutes, 1, 60, DEFAULT_BUDGET.maxRunDurationMinutes),
  };

  return {
    languages: languages.length > 0 ? [...new Set(languages)] : DEFAULT_DIRECTIVE.languages,
    levels: levels.length > 0 ? [...new Set(levels)] : DEFAULT_DIRECTIVE.levels,
    topics: [...new Set(topics)],
    storiesPerSlot,
    note: typeof input.note === "string" ? input.note.slice(0, 500) : "",
    active: typeof input.active === "boolean" ? input.active : true,
    updatedBy: typeof input.updatedBy === "string" ? input.updatedBy : "",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
    budget,
  };
}

export async function loadDirective(): Promise<ContentDirective> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL) return cached;

  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await (prisma as any).studioConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    if (row?.value) {
      cached = sanitizeDirective(row.value);
      cachedAt = now;
      return cached;
    }
  } catch {
    // Fall back to defaults
  }

  cached = DEFAULT_DIRECTIVE;
  cachedAt = now;
  return cached;
}

export async function saveDirective(directive: ContentDirective): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const sanitized = sanitizeDirective(directive);

  await (prisma as any).studioConfig.upsert({
    where: { key: CONFIG_KEY },
    create: {
      key: CONFIG_KEY,
      value: sanitized,
      updatedBy: sanitized.updatedBy,
    },
    update: {
      value: sanitized,
      updatedBy: sanitized.updatedBy,
    },
  });

  cached = sanitized;
  cachedAt = Date.now();
}

export function invalidateDirectiveCache() {
  cached = null;
  cachedAt = 0;
}

export const DIRECTIVE_CONFIG_KEY = CONFIG_KEY;
