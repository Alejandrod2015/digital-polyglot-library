// Pure helpers que deciden qué nivel/topic/story está desbloqueado en
// el journey, dado el set de stories completados y checkpoints pasados.
// Vive en lib (sin imports de Next / Prisma) para que web Y mobile lo
// puedan importar. Los tipos son structurals para no atar el módulo al
// shape específico del web ni del mobile: cualquier objeto con `id`,
// `slug`, `stories`, `progressKey`, `topics` cuadra.
//
// Política de "level complete" (alias "express path desactivado"):
//   - Un topic gating es uno con al menos una story publicada.
//   - Un nivel se considera completo cuando al menos 75% de sus topics
//     gating están completos (todas sus stories completadas + checkpoint
//     pasado).
//   - El nivel siguiente al último completo se desbloquea.
// Política de "placement test override":
//   - Si el usuario aprobó el test de nivel y se posicionó en X,
//     getJourneyPlacementLevelIndex(X) >= 0 y todos los niveles
//     <= X quedan desbloqueados al mínimo.

export type JourneyStoryLike = {
  progressKey: string;
};
export type JourneyTopicLike = {
  // `slug` solo es necesario para checkpoints; las funciones que solo
  // miran historias (isJourneyTopicComplete, getJourneyTopicCompletedStoryCount,
  // etc.) lo tratan como opcional para compatibilidad con callers que
  // pasan un `Pick<JourneyTopic, "stories" | "storyTarget">`.
  slug?: string;
  stories: ReadonlyArray<JourneyStoryLike>;
  storyTarget?: number | null;
};
export type JourneyLevelLike = {
  id: string;
  topics: ReadonlyArray<JourneyTopicLike>;
};

export const JOURNEY_LEVEL_IDS = ["a1", "a2", "b1", "b2", "c1", "c2"] as const;
export type JourneyPlacementLevelId = (typeof JOURNEY_LEVEL_IDS)[number];

const LEVEL_COMPLETION_THRESHOLD = 0.75;

export function isJourneyStoryComplete(
  story: JourneyStoryLike,
  completedStoryKeys: ReadonlySet<string>
): boolean {
  return completedStoryKeys.has(story.progressKey);
}

export function getJourneyTopicRequiredStoryCount(topic: JourneyTopicLike): number {
  if (topic.stories.length === 0) return 0;
  if (typeof topic.storyTarget === "number" && Number.isFinite(topic.storyTarget)) {
    return Math.max(1, Math.min(topic.storyTarget, topic.stories.length));
  }
  return topic.stories.length;
}

export function getJourneyTopicCompletedStoryCount(
  topic: JourneyTopicLike,
  completedStoryKeys: ReadonlySet<string>
): number {
  return topic.stories.filter((story) => isJourneyStoryComplete(story, completedStoryKeys)).length;
}

export function isJourneyTopicComplete(
  topic: JourneyTopicLike,
  completedStoryKeys: ReadonlySet<string>
): boolean {
  const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
  if (requiredStoryCount === 0) return false;
  return getJourneyTopicCompletedStoryCount(topic, completedStoryKeys) >= requiredStoryCount;
}

export function isTopicGating(topic: JourneyTopicLike): boolean {
  return topic.stories.length > 0;
}

export function getJourneyTopicCheckpointKey(
  variantId: string | undefined,
  levelId: string,
  topicSlug: string
): string {
  return `${variantId ?? "default"}:${levelId}:${topicSlug}`;
}

export function isJourneyLevelComplete(
  level: JourneyLevelLike,
  completedStoryKeys: ReadonlySet<string>,
  passedCheckpointKeys: ReadonlySet<string>,
  variantId?: string
): boolean {
  if (level.topics.length === 0) return false;
  const gatingTopics = level.topics.filter(isTopicGating);
  if (gatingTopics.length === 0) return false;
  const required = Math.max(1, Math.ceil(gatingTopics.length * LEVEL_COMPLETION_THRESHOLD));
  let cleared = 0;
  for (const topic of gatingTopics) {
    if (!isJourneyTopicComplete(topic, completedStoryKeys)) continue;
    // Topics without `slug` no pueden tener checkpoint (no hay key
    // estable); los tratamos como "no checkpoint passed" y los saltamos.
    if (!topic.slug) continue;
    if (!passedCheckpointKeys.has(getJourneyTopicCheckpointKey(variantId, level.id, topic.slug))) continue;
    cleared += 1;
    if (cleared >= required) return true;
  }
  return false;
}

export function getUnlockedLevelCount(
  levels: ReadonlyArray<JourneyLevelLike>,
  completedStoryKeys: ReadonlySet<string>,
  passedCheckpointKeys: ReadonlySet<string>,
  variantId?: string
): number {
  if (levels.length === 0) return 0;
  let unlockedCount = 1;
  for (let index = 0; index < levels.length - 1; index += 1) {
    if (!isJourneyLevelComplete(levels[index], completedStoryKeys, passedCheckpointKeys, variantId)) {
      break;
    }
    unlockedCount += 1;
  }
  return Math.min(unlockedCount, levels.length);
}

export function normalizeJourneyPlacementLevel(value: unknown): JourneyPlacementLevelId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return JOURNEY_LEVEL_IDS.includes(normalized as JourneyPlacementLevelId)
    ? (normalized as JourneyPlacementLevelId)
    : null;
}

export function getJourneyPlacementLevelIndex<L extends { id: string }>(
  levels: ReadonlyArray<L>,
  placementLevelId: string | null | undefined
): number {
  const normalizedPlacement = normalizeJourneyPlacementLevel(placementLevelId);
  if (!normalizedPlacement) return -1;
  return levels.findIndex((level) => level.id === normalizedPlacement);
}

// Convenience: combina baseUnlock (por completar historias) con el
// placement (test de nivel) y devuelve el count efectivo. Si el usuario
// aprobó B1 en el test, garantiza que A1/A2/B1 estén desbloqueados aun
// cuando no haya completado las historias intermedias.
export function getEffectiveUnlockedLevelCount(
  levels: ReadonlyArray<JourneyLevelLike>,
  completedStoryKeys: ReadonlySet<string>,
  passedCheckpointKeys: ReadonlySet<string>,
  placementLevelId: string | null | undefined,
  variantId?: string
): number {
  const baseUnlocked = getUnlockedLevelCount(
    levels,
    completedStoryKeys,
    passedCheckpointKeys,
    variantId
  );
  const placementIndex = getJourneyPlacementLevelIndex(levels, placementLevelId);
  if (placementIndex < 0) return baseUnlocked;
  return Math.max(baseUnlocked, Math.min(levels.length, placementIndex + 1));
}
