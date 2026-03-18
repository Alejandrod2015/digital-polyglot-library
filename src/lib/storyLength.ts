export const MIN_STORY_WORDS = 220;
export const TARGET_STORY_WORDS_MIN = 280;
export const TARGET_STORY_WORDS_MAX = 340;
export const HARD_STORY_WORDS_MAX = 380;

export function countStoryWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
