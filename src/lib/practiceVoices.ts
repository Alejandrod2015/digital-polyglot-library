/**
 * Single source of truth for which TTS voices the practice pipeline can
 * actually synthesize. Used by:
 *   - /api/practice/sentence-tts (gates the hinted voiceId)
 *   - /api/studio/practice-sets/[storyId]/exercises/[id]/audio (regen)
 *   - /api/studio/practice-voices/[language] (drives the dropdown)
 *   - scripts/regen-practice-audios.ts (CLI regen)
 *
 * Must stay in sync with `modal_app/audio_studio.py`'s PIPER_VOICES /
 * KOKORO_VOICES maps; every entry here MUST have a Modal handler.
 */

export type PracticeVoice = {
  /** Voice id in the form `engine/voiceSlug`. Stable across services. */
  id: string;
  /** Engine prefix (first segment of `id`). */
  engine: "piper" | "kokoro";
  /** Display label for the dropdown. */
  label: string;
  /** Lower-cased language name (`spanish`, `italian`, `portuguese`, ...). */
  language: string;
  /** Region tag (`MX`, `ES`, `BR`, `IT`, ...). Optional, mostly for UI. */
  region?: string;
  /** Gender of the speaker as a one-letter code. */
  gender: "m" | "f";
};

const PRACTICE_VOICE_LIST: PracticeVoice[] = [
  { id: "piper/it_IT-paola-medium",   engine: "piper",  label: "Paola (IT, F)",                language: "italian",    region: "IT", gender: "f" },
  { id: "piper/es_ES-sharvard-medium",engine: "piper",  label: "Sharvard (ES, M)",             language: "spanish",    region: "ES", gender: "m" },
  { id: "piper/es_MX-claude-high",    engine: "piper",  label: "Claude (MX, M, high)",         language: "spanish",    region: "MX", gender: "m" },
  { id: "kokoro/ef_dora",             engine: "kokoro", label: "Dora (ES, F, Kokoro)",         language: "spanish",                gender: "f" },
  { id: "kokoro/em_alex",             engine: "kokoro", label: "Alex (ES, M, Kokoro)",         language: "spanish",                gender: "m" },
  { id: "kokoro/em_santa",            engine: "kokoro", label: "Santa (ES, M, Kokoro Xmas)",   language: "spanish",                gender: "m" },
  { id: "piper/pt_BR-cadu-medium",    engine: "piper",  label: "Cadu (BR, M)",                 language: "portuguese", region: "BR", gender: "m" },
];

const PRACTICE_VOICE_BY_ID = new Map(PRACTICE_VOICE_LIST.map((v) => [v.id, v]));

/** Default voice per language used when a story has no `practiceVoiceId`. */
const DEFAULT_BY_LANGUAGE: Record<string, string> = {
  spanish: "kokoro/ef_dora",
  portuguese: "piper/pt_BR-cadu-medium",
  italian: "piper/it_IT-paola-medium",
};

export function listPracticeVoices(language?: string | null): PracticeVoice[] {
  if (!language) return PRACTICE_VOICE_LIST;
  const key = language.toLowerCase();
  return PRACTICE_VOICE_LIST.filter((v) => v.language === key);
}

export function isPracticeVoiceSupported(id: string | null | undefined): boolean {
  if (!id) return false;
  return PRACTICE_VOICE_BY_ID.has(id);
}

export function getPracticeVoice(id: string | null | undefined): PracticeVoice | null {
  if (!id) return null;
  return PRACTICE_VOICE_BY_ID.get(id) ?? null;
}

/**
 * Resolves the voice to actually use for a given (story, language) pair.
 * Order:
 *   1. Per-story override (`story.practiceVoiceId`); if it exists AND
 *      is in the supported list AND matches the language.
 *   2. Per-language default.
 *   3. null (no voice available for this language; caller decides
 *      whether to 404 or fall back to expo-speech client-side).
 */
export function resolvePracticeVoice(
  storyPracticeVoiceId: string | null | undefined,
  language: string | null | undefined
): string | null {
  const lang = (language ?? "").toLowerCase();
  if (storyPracticeVoiceId) {
    const v = PRACTICE_VOICE_BY_ID.get(storyPracticeVoiceId);
    if (v && (!lang || v.language === lang)) return storyPracticeVoiceId;
  }
  return DEFAULT_BY_LANGUAGE[lang] ?? null;
}
