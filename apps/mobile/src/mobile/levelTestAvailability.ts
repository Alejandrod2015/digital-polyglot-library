/**
 * Languages whose level test is the STORY test: four curated practice
 * exercises per rung, served by `/api/mobile/level-test` and run in the
 * app's own practice session (2026-09-20). The other languages keep the
 * bundled grammar quiz (`LevelTestRunner`) until they have curated sets
 * with audio at every level.
 */
export const STORY_LEVEL_TEST_LANGUAGES = new Set(["Spanish"]);

export function hasStoryLevelTest(language: string | null | undefined): boolean {
  return Boolean(language && STORY_LEVEL_TEST_LANGUAGES.has(language));
}
