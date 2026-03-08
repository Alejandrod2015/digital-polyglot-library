export const MIN_STORY_WORDS = 260;
export const TARGET_STORY_WORDS_MIN = 340;
export const TARGET_STORY_WORDS_MAX = 460;
export const HARD_STORY_WORDS_MAX = 500;

export function countStoryWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
