// Type-safe read/write helpers for `JourneyStory.voiceProvenance` JSON
// column. Used to track per-story metadata that doesn't merit its own
// DB column: the most important is the DRY STEM (the post-TTS, post-
// loudnorm buffer BEFORE the ambient bed was mixed in).
//
// Why we store dry stems:
// When a multi-voice master is generated, voices and ambient are fused
// pixel-by-pixel into the final mp3. Splicing a new tramo into that
// master forces us to re-mix ambient from scratch in the new tramo -
// the ambient loop starts from sample 0 instead of continuing the
// master's phase, producing an audible "shimmer" at the splice seam.
//
// With the dry stem stored separately, the audio editor can:
//   1. Splice the new dry TTS into the dry stem (voices-only).
//   2. Render the ambient ONCE over the resulting full-length voice
//      track. The ambient is now continuous; no seam in the noise.
//
// Old stories generated before this column was populated have no dry
// stem; the editor falls back to the legacy splice path (with the
// shimmer) for those. New stories produced after this change get dry
// stems automatically.

export type VoiceProvenance = {
  /** R2 URL to the dry-narration mp3 (post-loudnorm, pre-ambient mix). */
  dryUrl?: string | null;
  /** Filename used as R2 object key suffix. */
  dryFilename?: string | null;
  /** Same as dryUrl but for the pending preview (set by preview-segment
   *  / preview-title, swapped into dryUrl on promote, cleared on discard). */
  previewDryUrl?: string | null;
  previewDryFilename?: string | null;
  // Forward-compatible: preserve any other keys callers may have set.
  [key: string]: unknown;
};

/** Coerce the raw Prisma JsonValue into a typed object. Returns an empty
 *  object when the column is null/array/scalar. Never mutates input. */
export function readVoiceProvenance(raw: unknown): VoiceProvenance {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as VoiceProvenance) };
  }
  return {};
}

/** Merge `patch` into the existing voiceProvenance and return the new
 *  object. Existing keys are preserved unless overridden. Pass `null`
 *  to a key to explicitly clear it. */
export function mergeVoiceProvenance(
  existing: unknown,
  patch: Partial<VoiceProvenance>,
): VoiceProvenance {
  const base = readVoiceProvenance(existing);
  return { ...base, ...patch };
}
