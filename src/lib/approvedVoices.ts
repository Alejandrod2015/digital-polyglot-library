/**
 * APPROVED VOICES — single source of truth for which ElevenLabs voiceIds may
 * be used to render PRODUCTION audio (story narration, practice clips, word
 * audio). This exists because on 2026-07-19 a story was narrated with a voice
 * the user had NOT approved ("Narrator AR - Lucas"), picked as a candidate.
 *
 * HARD RULE: production audio may only be synthesized with a voiceId listed
 * here. `assertVoiceApproved` is called at every production TTS chokepoint
 * (src/lib/elevenlabs.ts, scripts/_genPracticeClips.ts, scripts/_genJourneyWords.ts)
 * and THROWS if the voice is not approved. There is no env-var bypass.
 *
 * WHO EDITS THIS FILE: the USER approves voices. Claude must NOT add an entry
 * on its own — a PreToolUse guard (.claude/safety/pre-voice-approval-guard.sh)
 * blocks edits to this file unless the user's most recent message contains an
 * explicit approval phrase ("aprueba la voz" / "apruebo la voz" / "voz aprobada").
 * Auditioning a candidate is done with FREE preview URLs or a throwaway 1-line
 * sample script that does NOT write to production — never by adding it here
 * pre-emptively.
 *
 * Seed (2026-07-19): the voiceIds already shipped on PUBLISHED (Live) stories,
 * i.e. voices the user accepted into production. Draft-journey candidates
 * (AR/ES-A0/Hanseat/etc.) are intentionally absent until the user approves them.
 */

export type ApprovedVoice = { note: string };

export const APPROVED_VOICES: Record<string, ApprovedVoice> = {
  // Narrators / practice voices live on published journeys as of 2026-07-19.
  yHD4CsKkghm19ToGLJEC: { note: "Narrator CO - Hernando (Friends CO, Traveler LATAM) — user-approved" },
  FXGrCtY3PEyfqczBAlqm: { note: "Jhenny (practice LATAM / Friends) — user-approved" },
  Ww7Sq9tx9CCOiNOwWgsx: { note: "Expat DE + Friends DE narrator (published)" },
  JW8DGEuLp9WxIS5IdxMM: { note: "Friends/Traveler LATAM narrator (published)" },
  MjtZn5tagxL1RO6w9ER5: { note: "Traveler LATAM voice (published)" },
  kIVGrdJmAh9zNqLfBLUo: { note: "Traveler LATAM voice (published)" },
  "6Gr4AVmTax1pMJO0lHRK": { note: "Friends LATAM voice (published)" },
  yytxkT3pNVMWDHn3KXrY: { note: "Traveler LATAM voice (published)" },
  acHf5gp7AGOY30tJjvD4: { note: "Friends LATAM voice (published)" },
  "57D8YIbQSuE3REDPO6Vm": { note: "Friends LATAM voice (published)" },
  zwsW3KvGYEC2nBc7rlnA: { note: "Traveler LATAM voice (published)" },
};

export function isVoiceApproved(voiceId: string | null | undefined): boolean {
  return !!voiceId && Object.prototype.hasOwnProperty.call(APPROVED_VOICES, voiceId.trim());
}

/**
 * Throws unless `voiceId` is on the approved allowlist. Call this immediately
 * before any PRODUCTION ElevenLabs text-to-speech synthesis. `context` is a
 * short label for the error (e.g. "narration:feria-de-san-telmo").
 */
export function assertVoiceApproved(voiceId: string | null | undefined, context = ""): void {
  if (isVoiceApproved(voiceId)) return;
  const where = context ? ` (${context})` : "";
  throw new Error(
    `[approved-voices] BLOCKED: voiceId "${voiceId ?? "<none>"}" is NOT user-approved${where}. ` +
      `Production audio can only be rendered with a voice in src/lib/approvedVoices.ts. ` +
      `Audition candidates with FREE preview URLs or a 1-line throwaway sample; the USER adds ` +
      `the voice to the allowlist (gated by pre-voice-approval-guard.sh) once they approve it by ear.`
  );
}
