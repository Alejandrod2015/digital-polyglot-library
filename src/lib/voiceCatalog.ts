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

export type Engine = "kokoro" | "piper" | "f5" | "coqui" | "bark";
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

  // German candidates — all passed UTMOS ≥ 3.0. NO THORSTEN VARIANTS (user-banned).
  { id: "bark/de_speaker_4",                       engine: "bark",  language: "german", region: "DE", gender: "m", label: "Bark Speaker 4 (Alemania) · UTMOS 3.61", status: "candidate" },
  { id: "coqui/de_DE-css10-vits-neon",             engine: "coqui", language: "german", region: "DE", gender: "f", label: "Coqui CSS10 (Alemania) · UTMOS 3.18",     status: "candidate" },
  { id: "bark/de_speaker_3",                       engine: "bark",  language: "german", region: "DE", gender: "m", label: "Bark Speaker 3 (Alemania) · UTMOS 3.02", status: "candidate" },
];

export const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  spanish:    "piper/es_ES-sharvard-medium",
  portuguese: "piper/pt_BR-cadu-medium",
  italian:    "piper/it_IT-paola-medium",
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
