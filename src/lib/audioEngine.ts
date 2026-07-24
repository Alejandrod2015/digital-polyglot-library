/**
 * Audio ENGINE discriminator — single source of truth for "is this voice
 * ElevenLabs?".
 *
 * POLICY (2026-07-24, user directive "solo ElevenLabs, o silencio"): the app
 * must only PLAY audio rendered by ElevenLabs. Local engines (Piper, Kokoro,
 * served via Modal) are identified by an engine-prefixed voiceId like
 * `piper/it_IT-paola-medium` or `kokoro/ef_dora`. A raw ElevenLabs voiceId has
 * no `/` (e.g. `Ww7Sq9tx9CCOiNOwWgsx`); an `elevenlabs/<id>` prefix is also EL.
 *
 * This is the ENGINE check (EL vs local), NOT the approval check. Voice
 * CURATION (only allowlisted EL voices) is a separate, stricter policy in
 * `approvedVoices.ts`; use `isVoiceApproved` for GENERATION chokepoints and
 * `isElevenLabsVoiceId` for muting already-rendered playback.
 */

export function voiceEngine(voiceId: string | null | undefined): "elevenlabs" | "piper" | "kokoro" | "unknown" | "none" {
  const v = (voiceId ?? "").trim();
  if (!v) return "none";
  if (!v.includes("/")) return "elevenlabs"; // raw EL id
  const prefix = v.split("/", 1)[0].toLowerCase();
  if (prefix === "elevenlabs") return "elevenlabs";
  if (prefix === "piper") return "piper";
  if (prefix === "kokoro") return "kokoro";
  return "unknown";
}

/** True only when the voice is rendered by ElevenLabs (raw id or elevenlabs/…). */
export function isElevenLabsVoiceId(voiceId: string | null | undefined): boolean {
  return voiceEngine(voiceId) === "elevenlabs";
}
