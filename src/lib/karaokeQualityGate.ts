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
 * Every story measured below the bar, from scoring ALL 346 payloads against
 * the whisper ruler on 2026-07-28. The healthy library sits at 0.190 s of
 * median error (worst healthy story 0.450 s); the approved reference,
 * kehrwoche-bei-achim, at 0.170 s.
 *
 * Regenerate the list with `scripts/_karaokeFullScore.py` +
 * `scripts/_karaokeGateList.py`. A story leaves this list by having its
 * content fixed and re-measured, never by loosening the gate.
 */
export const KARAOKE_BLOCKED_SLUGS: ReadonlySet<string> = new Set([
  // WRONG AUDIO: barely any of the text is heard in the recording, so the
  // story is paired with a different narration. Fix the pairing.
  "el-vendedor-ambulante", //   6% of words match, 55.7 s error
  "la-tradicion-del-mate", //  23% of words match

  // SHORT TEXT: the words match but the audio narrates far more of them; the
  // stored text is an abridged version. Restore the text.
  "la-excursion-a-la-sierra-nevada", // 374 words vs 781 heard, 58.0 s
  "la-fiesta-en-cartagena", //          40.9 s
  "la-leyenda-de-la-llorona", //        39.6 s
  "el-carnaval-de-barranquilla", //     31.2 s
  "el-tren-de-la-sabana", //             2.8 s
  "la-feria-de-las-flores", //           1.3 s
  "el-festival-de-la-arepa", //          0.8 s
  "la-finca-en-la-montana", //           0.8 s
  "el-misterio-de-la-catedral-de-sal", //0.7 s
  "el-viaje-a-villa-de-leyva", //        0.7 s
  "el-secreto-del-cafe", //              0.5 s

  // WEAK ALIGNMENT: content is fine (93-99% of words match, counts match) but
  // the aligner placed them ~0.5 s off, which puts the highlight on the wrong
  // word most of the time. Re-aligning was tried and does not fix it: aeneas
  // is not deterministic, and a second pass moved these by ±0.05 s in both
  // directions. Cause unknown; il-libro-dell-abisso at least carries an
  // ambient bed that hides its pauses.
  "el-estudiante-universitario", // 0.57 s
  "el-misterio-del-bosque", //      0.51 s
  "il-libro-dell-abisso", //        0.48 s
  "l-ultimo-respiro-del-campanile", // 0.45 s

  // Not user-facing today (deprecated / unpublished journeys), listed so they
  // cannot start showing a bad highlight if those journeys are ever opened.
  "una-pizca-de-canela", //        0.76 s, journey "Traveler — Legacy"
  "el-libro-en-voz-alta", //       0.58 s, marked [DEPRECATED]
  "trastevere-camera-quattro", //  0.51 s, journey "Traveler — Test"
]);

export type KaraokeGateResult = { usable: boolean; reason?: string };

export function checkKaraokeUsable(
  slug: string | null | undefined,
  payload: Pick<AudioWordTimingsPayload, "words" | "audioDurationSec"> | null
): KaraokeGateResult {
  if (!payload) return { usable: false, reason: "no timings" };
  if (slug && KARAOKE_BLOCKED_SLUGS.has(slug)) {
    // The specific cause (wrong audio / abridged text / weak alignment) is
    // documented next to each slug in the list above.
    return { usable: false, reason: "measured below the karaoke quality bar" };
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
