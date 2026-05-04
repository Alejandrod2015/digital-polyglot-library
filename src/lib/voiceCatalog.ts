/** Voice catalog: shared between Studio UI and the local TTS endpoint.
 *
 * voiceId convention: "<engine>/<voiceName>" — e.g. "piper/es_ES-sharvard-medium".
 *
 * Each entry has a `status`:
 *  - "approved": validated by the user, available in the story dropdowns.
 *  - "candidate": added for testing; visible only in the gallery, NOT selectable
 *    for story generation until promoted.
 *
 * Quality gate (mandatory before any voice gets added):
 *   1. Whisper WER ≤ 40% on a standard sentence (intelligibility).
 *   2. UTMOS ≥ 3.0 (predicted MOS, naturalness — calibrated against
 *      user-approved voices: Sharvard 3.11, Paola 3.55, Cadu 4.03).
 *   3. Audio metrics in range (RMS, silence ratio).
 *
 * Voices below UTMOS 3.0 are auto-rejected — no exceptions, no manual review.
 * UTMOS prevents the "intelligible but robotic" failure mode that Whisper alone
 * can't detect.
 *
 * Filter heuristic for sourcing candidates: engine=piper-medium / bark / coqui
 * single-speaker studio datasets. Anything multi-speaker or low-quality skipped.
 */

export type Engine = "kokoro" | "piper" | "f5" | "coqui" | "bark" | "elevenlabs";
export type VoiceStatus = "approved" | "candidate";

export type VoiceEntry = {
  id: string;
  engine: Engine;
  language: string;
  region?: string;
  gender: "f" | "m";
  label: string;
  status: VoiceStatus;
};

export const VOICE_CATALOG: VoiceEntry[] = [
  // Approved
  { id: "piper/es_ES-sharvard-medium", engine: "piper", language: "spanish",    region: "ES", gender: "m", label: "Sharvard (España, masculina)", status: "approved" },
  { id: "piper/pt_BR-cadu-medium",     engine: "piper", language: "portuguese", region: "BR", gender: "m", label: "Cadu (Brasil, masculina)",      status: "approved" },
  { id: "piper/it_IT-paola-medium",    engine: "piper", language: "italian",    region: "IT", gender: "f", label: "Paola (Italia, femenina)",     status: "approved" },

  // German voices. NO THORSTEN VARIANTS (user-banned, perceptually depressing).
  { id: "bark/de_speaker_4",            engine: "bark",  language: "german", region: "DE", gender: "m", label: "Bark Speaker 4 (Alemania, masculina)", status: "approved" },
  { id: "coqui/de_DE-css10-vits-neon",  engine: "coqui", language: "german", region: "DE", gender: "f", label: "Coqui CSS10 (Alemania, femenina)",     status: "approved" },

  // ElevenLabs voices for German dialogue stories. All native-DE accent.
  // Synthesized via eleven_multilingual_v2 with DEFAULT_VOICE_SETTINGS
  // (stability=0.7, speed=0.9, style=0).
  // License terms (verified against ElevenLabs API):
  //   - Moritz, ENNIAH: premade default voices (perpetual, owned by ElevenLabs).
  //   - Sebastian, Eleonore: professional shared library, notice_period=730
  //     days (2 years, the max available in the marketplace).
  // No US-accent voices kept here; Sarah and Liam retired.
  { id: "elevenlabs/Ww7Sq9tx9CCOiNOwWgsx", engine: "elevenlabs", language: "german", region: "DE", gender: "m", label: "Moritz Morgenstern (narrador, perpetual)", status: "approved" },
  { id: "elevenlabs/WHaUUVTDq47Yqc9aDbkH", engine: "elevenlabs", language: "german", region: "DE", gender: "f", label: "ENNIAH (femenino mature, perpetual)", status: "approved" },
  { id: "elevenlabs/qVRpsZJDV29g1CIPzssm", engine: "elevenlabs", language: "german", region: "DE", gender: "m", label: "Sebastian (masculino joven, 2yr)", status: "approved" },
  { id: "elevenlabs/8SdTD5IMgFKT1jp7JbPC", engine: "elevenlabs", language: "german", region: "DE", gender: "f", label: "Eleonore (femenino mature, narrator, 2yr)", status: "approved" },
];

export const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  spanish:    "piper/es_ES-sharvard-medium",
  portuguese: "piper/pt_BR-cadu-medium",
  italian:    "piper/it_IT-paola-medium",
  german:     "bark/de_speaker_4",
};

export function findVoice(voiceId: string | null | undefined): VoiceEntry | null {
  if (!voiceId) return null;
  return VOICE_CATALOG.find((v) => v.id === voiceId) ?? null;
}

export function approvedVoices(): VoiceEntry[] {
  return VOICE_CATALOG.filter((v) => v.status === "approved");
}

export function voicesForLanguage(language: string, status: VoiceStatus = "approved"): VoiceEntry[] {
  const lang = language.toLowerCase();
  return VOICE_CATALOG.filter((v) => v.language === lang && v.status === status);
}
