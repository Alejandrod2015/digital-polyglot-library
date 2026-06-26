// Hard guard so Studio can NEVER produce single-voice audio for a story that
// has characters. The bug it prevents: a dialogue story (narrator + speakers)
// generated before its dialogueSpec was set fell back to one voice. This makes
// that impossible at the API layer (the source of truth, can't be bypassed by
// any UI button).
//
// Airtight rule: if the body has 2+ speakers, EVERY speaker must have a voice
// in the dialogueSpec AND there must be ≥2 distinct voices. A spec that misses
// a character (stale after a text edit) or maps everyone to one voice is
// rejected; exactly the cases that otherwise leak a fallback/single voice.
import { parseDialogueSegments } from "@/lib/elevenlabs";

/** Distinct speakers in a story body (narrator counts as one). Empty → 0. */
export function countStorySpeakers(storyText: string | null | undefined): number {
  if (!storyText) return 0;
  return new Set(parseDialogueSegments(storyText).map((s) => s.speaker.toLowerCase())).size;
}

/**
 * Returns a user-facing error string when generation must be BLOCKED, or null
 * when it may proceed. Pure single-speaker narrations pass through (single
 * voice is correct for them).
 */
export function multiVoiceGuardError(args: {
  storyText: string | null | undefined;
  dialogueSpec: unknown;
}): string | null {
  const textSpeakers = new Set(
    parseDialogueSegments(args.storyText ?? "").map((s) => s.speaker.toLowerCase()),
  );
  if (textSpeakers.size <= 1) return null; // pure narration → single voice is legitimate

  const spec = args.dialogueSpec;
  if (!Array.isArray(spec) || spec.length === 0) {
    return `Esta historia tiene ${textSpeakers.size} hablantes (narrador + personajes) pero no tiene dialogueSpec. Asigna una voz a cada personaje antes de generar: en Studio no se permite audio de voz única para historias con diálogo.`;
  }

  // Map speaker → voice from the spec (mirrors how the multi-voice generator
  // builds its voiceMap: speaker.toLowerCase() → voiceId).
  const voiceBySpeaker = new Map<string, string>();
  for (const seg of spec as Array<{ speaker?: string | null; voice?: string | null }>) {
    if (seg?.speaker && seg?.voice) voiceBySpeaker.set(seg.speaker.toLowerCase(), seg.voice);
  }

  // Every speaker present in the body must have a voice, or that speaker would
  // fall back to another voice at generation time.
  const unmapped = [...textSpeakers].filter((s) => !voiceBySpeaker.get(s));
  if (unmapped.length > 0) {
    return `Faltan voces en el dialogueSpec para: ${unmapped.join(", ")}. Asigna una voz a cada personaje antes de generar (en Studio no se permite voz única para historias con diálogo).`;
  }

  const distinctVoices = new Set(voiceBySpeaker.values());
  if (distinctVoices.size < 2) {
    return `El dialogueSpec asigna una sola voz a todos los personajes. Asigna voces distintas antes de generar: en Studio no se permite audio de voz única para historias con diálogo.`;
  }

  return null;
}
