// Uniform length policy: same target across all CEFR levels. Audio cost
// scales linearly with words, and longer doesn't equal more pedagogical
// value; at higher levels what changes is density, not volume.
export const MIN_STORY_WORDS = 200;
export const TARGET_STORY_WORDS_MIN = 240;
export const TARGET_STORY_WORDS_MAX = 280;
export const HARD_STORY_WORDS_MAX = 320;

export function countStoryWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
