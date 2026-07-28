// Refuses to run the karaoke on stories where it is known to be wrong.
//
// Measured 2026-07-28: a group of catalog stories carries an `audio` that
// says considerably MORE than the stored `text`. Examples, text words vs
// words actually heard in the audio:
//
//   la-excursion-a-la-sierra-nevada   374 vs 781
//   la-leyenda-de-la-llorona          370 vs 678
//   el-tren-de-la-sabana              426 vs 691
//
// The audio starts and ends on the story's own first and last sentence, so
// the stored text is an abridged version of the same narration. Forced
// alignment then has to stretch 374 words over an audio containing 781, and
// the words land anywhere: median error 58 s, 40 s and 2.8 s against the
// whisper ruler, versus ~0.19 s on a healthy story.
//
// No aligner can fix that; the text (or the audio) has to change. Until it
// does, showing a confidently wrong highlight is worse than showing none, so
// these stories fall back to the plain reader.
//
// Pure module: safe on client and server.

import type { AudioWordTimingsPayload } from "./audioWordTimingsTypes";

/**
 * Narration across the healthy library runs at a median of 2.43 words/second
 * and no journey story sits below 1.96. A story far under that is not slow
 * narration, it is an audio saying more than the text.
 *
 * The threshold is deliberately loose: it is a backstop for stories nobody
 * has measured yet. Everything already measured is listed explicitly below,
 * because the rate alone does not separate the two groups cleanly (a story at
 * 1.83 words/s measured 0.52 s of error while another at 1.69 was fine).
 */
const MIN_WORDS_PER_SEC = 1.2;

/**
 * Stories whose text/audio mismatch was confirmed against the whisper ruler.
 * Regenerate with `scripts/_karaokeFullScore.py`; a story leaves this list by
 * having its text or its audio fixed, not by loosening the gate.
 */
export const KARAOKE_BLOCKED_SLUGS: ReadonlySet<string> = new Set([
  "la-excursion-a-la-sierra-nevada",
  "la-leyenda-de-la-llorona",
  "el-tren-de-la-sabana",
  "la-feria-de-las-flores",
  "el-festival-de-la-arepa",
  "el-secreto-del-cafe",
]);

export type KaraokeGateResult = { usable: boolean; reason?: string };

export function checkKaraokeUsable(
  slug: string | null | undefined,
  payload: Pick<AudioWordTimingsPayload, "words" | "audioDurationSec"> | null
): KaraokeGateResult {
  if (!payload) return { usable: false, reason: "no timings" };
  if (slug && KARAOKE_BLOCKED_SLUGS.has(slug)) {
    return { usable: false, reason: "text does not match the audio" };
  }
  const timed = payload.words.filter((w) => typeof w.startSec === "number").length;
  if (timed === 0) return { usable: false, reason: "no timed words" };

  const duration = payload.audioDurationSec;
  if (typeof duration === "number" && duration > 0) {
    const rate = timed / duration;
    if (rate < MIN_WORDS_PER_SEC) {
      return { usable: false, reason: `only ${rate.toFixed(2)} words/s: the audio says more than the text` };
    }
  }
  return { usable: true };
}
