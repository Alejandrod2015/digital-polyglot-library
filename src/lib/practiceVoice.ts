/**
 * RULE (2026-07) — practice audio voice follows the STORY'S country.
 *
 * The isolated-word audio (▶ word) and the example-sentence clips (▶ sentence)
 * in the curated practice sets MUST be spoken in the story's OWN narrator voice,
 * so the accent matches the country the story is set in. NEVER a single
 * hardcoded voice: the Spanish-LATAM journey spans Colombia, Argentina, México,
 * Perú and Chile, and each story's narrator is already region-matched by the
 * journey config (`JourneyStory.voiceId`). A Mexican story (mole, tacos) must
 * not be practised in a Colombian voice.
 *
 * Both the runtime (word-tts endpoint / practice page) and the generation
 * scripts (`_genPracticeClips`, `_genJourneyWords`) resolve the voice through
 * this one function, so the rule cannot drift between them.
 */
export function practiceVoiceId(storyNarratorVoiceId: string | null | undefined): string {
  const v = (storyNarratorVoiceId ?? "").trim();
  if (!v) throw new Error("practice voice: story has no narrator voiceId (JourneyStory.voiceId)");
  // Callers may store the voice with an `elevenlabs/` engine prefix; the raw
  // ElevenLabs id is what both the cache key and the API expect.
  return v.startsWith("elevenlabs/") ? v.slice("elevenlabs/".length) : v;
}
