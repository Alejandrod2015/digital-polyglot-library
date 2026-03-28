export type PlannerScope = "full" | "language" | "journey";

export type PlannerRuntimeConfig = {
  defaultGapScope: PlannerScope;
  defaultGapLanguage: string;
  availableLanguages: string[];
  availableLevels: string[];
  defaultTargetLanguages: string[];
  defaultTargetLevels: string[];
  defaultStoriesPerLevel: number;
  expectedSlotsPerTopic: number;
  maxVisibleGaps: number;
};

export const DEFAULT_PLANNER_CONFIG: PlannerRuntimeConfig = {
  defaultGapScope: "full",
  defaultGapLanguage: "es",
  availableLanguages: ["es", "pt", "fr", "it", "de", "ko", "en"],
  availableLevels: ["a1", "a2", "b1", "b2", "c1"],
  defaultTargetLanguages: ["es"],
  defaultTargetLevels: ["a1", "a2", "b1", "b2"],
  defaultStoriesPerLevel: 4,
  expectedSlotsPerTopic: 4,
  maxVisibleGaps: 50,
};

const CONFIG_KEY = "planner_runtime_config";
const RUNTIME_CACHE_TTL = 60_000;

let runtimeConfig: PlannerRuntimeConfig | null = null;
let runtimeConfigTs = 0;

function uniqueNormalized(values: string[], fallback: string[]) {
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(normalized.length > 0 ? normalized : fallback));
}

function sanitizeConfig(raw: unknown): PlannerRuntimeConfig {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaultGapScope =
    input.defaultGapScope === "full" || input.defaultGapScope === "language" || input.defaultGapScope === "journey"
      ? input.defaultGapScope
      : DEFAULT_PLANNER_CONFIG.defaultGapScope;

  const availableLanguages = uniqueNormalized(
    Array.isArray(input.availableLanguages) ? input.availableLanguages.filter((value): value is string => typeof value === "string") : [],
    DEFAULT_PLANNER_CONFIG.availableLanguages
  );
  const availableLevels = uniqueNormalized(
    Array.isArray(input.availableLevels) ? input.availableLevels.filter((value): value is string => typeof value === "string") : [],
    DEFAULT_PLANNER_CONFIG.availableLevels
  );
  const defaultTargetLanguages = uniqueNormalized(
    Array.isArray(input.defaultTargetLanguages)
      ? input.defaultTargetLanguages.filter((value): value is string => typeof value === "string")
      : [],
    DEFAULT_PLANNER_CONFIG.defaultTargetLanguages
  ).filter((value) => availableLanguages.includes(value));
  const defaultTargetLevels = uniqueNormalized(
    Array.isArray(input.defaultTargetLevels)
      ? input.defaultTargetLevels.filter((value): value is string => typeof value === "string")
      : [],
    DEFAULT_PLANNER_CONFIG.defaultTargetLevels
  ).filter((value) => availableLevels.includes(value));

  const defaultGapLanguageRaw = typeof input.defaultGapLanguage === "string" ? input.defaultGapLanguage.trim().toLowerCase() : "";
  const defaultGapLanguage = availableLanguages.includes(defaultGapLanguageRaw)
    ? defaultGapLanguageRaw
    : availableLanguages[0] ?? DEFAULT_PLANNER_CONFIG.defaultGapLanguage;

  const defaultStoriesPerLevelRaw =
    typeof input.defaultStoriesPerLevel === "number" ? input.defaultStoriesPerLevel : Number(input.defaultStoriesPerLevel);
  const expectedSlotsPerTopicRaw =
    typeof input.expectedSlotsPerTopic === "number" ? input.expectedSlotsPerTopic : Number(input.expectedSlotsPerTopic);
  const maxVisibleGapsRaw =
    typeof input.maxVisibleGaps === "number" ? input.maxVisibleGaps : Number(input.maxVisibleGaps);

  return {
    defaultGapScope,
    defaultGapLanguage,
    availableLanguages,
    availableLevels,
    defaultTargetLanguages: defaultTargetLanguages.length > 0 ? defaultTargetLanguages : [defaultGapLanguage],
    defaultTargetLevels:
      defaultTargetLevels.length > 0 ? defaultTargetLevels : DEFAULT_PLANNER_CONFIG.defaultTargetLevels.filter((level) => availableLevels.includes(level)),
    defaultStoriesPerLevel:
      Number.isFinite(defaultStoriesPerLevelRaw) && defaultStoriesPerLevelRaw >= 1
        ? Math.floor(defaultStoriesPerLevelRaw)
        : DEFAULT_PLANNER_CONFIG.defaultStoriesPerLevel,
    expectedSlotsPerTopic:
      Number.isFinite(expectedSlotsPerTopicRaw) && expectedSlotsPerTopicRaw >= 1
        ? Math.floor(expectedSlotsPerTopicRaw)
        : DEFAULT_PLANNER_CONFIG.expectedSlotsPerTopic,
    maxVisibleGaps:
      Number.isFinite(maxVisibleGapsRaw) && maxVisibleGapsRaw >= 1
        ? Math.floor(maxVisibleGapsRaw)
        : DEFAULT_PLANNER_CONFIG.maxVisibleGaps,
  };
}

export async function loadPlannerConfig(): Promise<PlannerRuntimeConfig> {
  const now = Date.now();
  if (runtimeConfig && now - runtimeConfigTs < RUNTIME_CACHE_TTL) {
    return runtimeConfig;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await (prisma as any).studioConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    if (row?.value) {
      runtimeConfig = sanitizeConfig(row.value);
      runtimeConfigTs = now;
      return runtimeConfig;
    }
  } catch {
    // Fall back to defaults when DB access is unavailable.
  }

  runtimeConfig = DEFAULT_PLANNER_CONFIG;
  runtimeConfigTs = now;
  return runtimeConfig;
}

export function invalidatePlannerConfigCache() {
  runtimeConfig = null;
  runtimeConfigTs = 0;
}

export function sanitizePlannerConfig(raw: unknown): PlannerRuntimeConfig {
  return sanitizeConfig(raw);
}

export const PLANNER_CONFIG_KEY = CONFIG_KEY;
