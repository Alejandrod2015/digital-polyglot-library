// Sentence-level segments derived from word timings. Pure (no prisma, no
// child_process) so both the alignment pipeline and the repair scripts can
// use it without dragging server-only modules along.

import { alignStorySentencesToWords, type AudioSegment } from "./audioSegments";
import type { StoryWordToken } from "./audioWordTimingsTypes";

// Garantía estructural de que un clip no salpique audio del siguiente segment.
// Aeneas ancla con precisión el INICIO de cada palabra (onset audible) pero
// arrastra hasta ~200 ms de drift en el final por decay vocálico y, en
// historias multi-voz, por absorber tokens huérfanos del speaker label
// ("Anna:") al inicio de la siguiente oración. Forzar
// `endSec[i] <= startSec[i+1] - GUARD` hace imposible reproducir audio
// fuera del segment, aunque aeneas haya driftado dentro de la oración.
// En el peor caso queda un margencito de silencio inter-oración audible al
// final del clip, lo que es preferible a cortar habla o derramar al siguiente.
const NEXT_SEGMENT_GUARD_SEC = 0.02;

export function clampSegmentEndsToNextStart(segments: AudioSegment[]): AudioSegment[] {
  if (segments.length <= 1) return segments;
  return segments.map((segment, index) => {
    const next = segments[index + 1];
    if (!next) return segment;
    const upperBound = next.startSec - NEXT_SEGMENT_GUARD_SEC;
    if (!Number.isFinite(upperBound) || upperBound <= segment.startSec) return segment;
    if (segment.endSec <= upperBound) return segment;
    return { ...segment, endSec: upperBound };
  });
}

export function deriveSegmentsFromBodyTokens(
  storyPlainText: string,
  bodyTokens: StoryWordToken[]
): AudioSegment[] {
  const transcriptWords = bodyTokens
    .filter((t) => typeof t.startSec === "number" && typeof t.endSec === "number")
    .map((t) => ({ word: t.text, start: t.startSec ?? 0, end: t.endSec ?? 0 }));
  if (transcriptWords.length === 0) return [];
  const segments = alignStorySentencesToWords(storyPlainText, transcriptWords);
  return clampSegmentEndsToNextStart(segments);
}
