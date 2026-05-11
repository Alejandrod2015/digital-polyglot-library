// Parallel pipeline for word-level audio highlight ("karaoke" reader).
// Lives next to existing audio/transcript helpers WITHOUT touching them.
// The legacy sentence-level path in lib/elevenlabs.ts and lib/audioSegments.ts
// keeps working unchanged for every story that does not opt into this feature.
//
// Forced alignment runs in Modal (see modal_app/audio_studio.py:align). aeneas
// inside Modal takes (mp3, plain text, language) and returns a list of word
// tokens with character offsets and start/end seconds. We persist that JSON
// directly into the JourneyStory.audioWordTimings column.

import { alignStorySentencesToWords, type AudioSegment } from "@/lib/audioSegments";
import { prisma } from "@/lib/prisma";
import { extractStoryPlainText } from "./storyPlainText";

export const AUDIO_WORD_TIMINGS_VERSION = 1 as const;

export type StoryWordToken = {
  text: string;
  charStart: number;
  charEnd: number;
  startSec: number | null;
  endSec: number | null;
};

export type AudioWordTimingsPayload = {
  version: typeof AUDIO_WORD_TIMINGS_VERSION;
  audioDurationSec: number | null;
  storyPlainText: string;
  words: StoryWordToken[];
};

type ModalAlignResponse = {
  language?: string;
  audioDurationSec?: number | null;
  tokens?: Array<{
    text?: string;
    charStart?: number;
    charEnd?: number;
    startSec?: number | null;
    endSec?: number | null;
  }>;
};

const STUDIO_LANGUAGE_TO_ALIGN: Record<string, string> = {
  german: "german",
  de: "german",
  spanish: "spanish",
  es: "spanish",
  italian: "italian",
  it: "italian",
  portuguese: "portuguese",
  pt: "portuguese",
  english: "english",
  en: "english",
  french: "french",
  fr: "french",
};

export { extractStoryPlainText };

function resolveAlignUrl(): string {
  const explicit = (process.env.STUDIO_AUDIO_ALIGN_URL || "").trim();
  if (explicit) return explicit;
  // Fallback: derive from the synth URL by swapping the function name.
  // Matches the Modal naming convention `<account>--<app>-<function>.modal.run`.
  const synth = (process.env.STUDIO_AUDIO_URL || "").trim();
  if (synth.includes("-synthesize.modal.run")) {
    return synth.replace("-synthesize.modal.run", "-align.modal.run");
  }
  throw new Error(
    "Missing STUDIO_AUDIO_ALIGN_URL (and STUDIO_AUDIO_URL not in expected synth format)"
  );
}

export async function alignAudioOnModal(args: {
  audioUrl: string;
  plainText: string;
  language: string;
}): Promise<{
  audioDurationSec: number | null;
  tokens: StoryWordToken[];
}> {
  const token = (process.env.STUDIO_AUDIO_TOKEN || "").trim();
  if (!token) throw new Error("STUDIO_AUDIO_TOKEN is not configured");

  const mappedLanguage = STUDIO_LANGUAGE_TO_ALIGN[args.language.toLowerCase()] ?? args.language;
  const url = resolveAlignUrl();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: token,
      audioUrl: args.audioUrl,
      text: args.plainText,
      language: mappedLanguage,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modal align ${res.status}: ${detail.slice(0, 400)}`);
  }

  const data = (await res.json()) as ModalAlignResponse;
  if (!Array.isArray(data.tokens)) {
    throw new Error("Modal align returned no tokens array");
  }

  const tokens: StoryWordToken[] = [];
  for (const item of data.tokens) {
    if (typeof item.text !== "string") continue;
    if (typeof item.charStart !== "number" || typeof item.charEnd !== "number") continue;
    tokens.push({
      text: item.text,
      charStart: item.charStart,
      charEnd: item.charEnd,
      startSec:
        typeof item.startSec === "number" && Number.isFinite(item.startSec)
          ? item.startSec
          : null,
      endSec:
        typeof item.endSec === "number" && Number.isFinite(item.endSec) ? item.endSec : null,
    });
  }

  const audioDurationSec =
    typeof data.audioDurationSec === "number" && Number.isFinite(data.audioDurationSec)
      ? data.audioDurationSec
      : null;

  return { audioDurationSec, tokens };
}

// Mirrors `buildAudioNarrationText` from lib/elevenlabs.ts so the text we
// align with aeneas matches what was actually narrated. Without the title
// prefix the alignment treats the title's audio segment as if it were the
// first body word, which makes the highlight jump to body word #1 while
// the narrator is still speaking the title.
export function buildAlignmentText(titleRaw: string, bodyPlain: string): {
  fullText: string;
  bodyOffset: number;
} {
  const plainTitle = titleRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plainTitle) return { fullText: bodyPlain, bodyOffset: 0 };
  if (!bodyPlain) return { fullText: plainTitle, bodyOffset: plainTitle.length };
  const titleWithPause = /[.!?…:]$/.test(plainTitle) ? plainTitle : `${plainTitle}.`;
  const separator = "\n\n";
  return {
    fullText: `${titleWithPause}${separator}${bodyPlain}`,
    bodyOffset: titleWithPause.length + separator.length,
  };
}

export async function generateWordTimingsForStory(
  storyId: string
): Promise<AudioWordTimingsPayload> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      text: true,
      audioUrl: true,
      title: true,
      journey: { select: { language: true } },
    },
  });

  if (!story) throw new Error(`JourneyStory ${storyId} not found`);
  if (!story.text) throw new Error(`JourneyStory ${storyId} has no text`);
  if (!story.audioUrl) throw new Error(`JourneyStory ${storyId} has no audioUrl`);

  const { payload, segments } = await alignStoryAudio({
    text: story.text,
    title: story.title,
    audioUrl: story.audioUrl,
    language: story.journey.language,
    storyId,
  });

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioWordTimings: payload as unknown as object,
      ...(segments.length > 0 ? { audioSegments: segments as unknown as object } : {}),
    },
  });

  return payload;
}

/** Same alignment + segment derivation, but for `UserStory` rows.
 * Used by the practice flow when the favorite's storySlug points to a
 * user-generated (Polyglot create-page) story rather than a Studio journey
 * story. UserStory has no `audioWordTimings` column, so we only persist
 * `audioSegments`. The reader doesn't run karaoke for these. */
export async function generateAudioSegmentsForUserStory(storyId: string): Promise<{
  segmentCount: number;
  audioDurationSec: number | null;
}> {
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    select: { id: true, text: true, audioUrl: true, title: true, language: true },
  });

  if (!story) throw new Error(`UserStory ${storyId} not found`);
  if (!story.text) throw new Error(`UserStory ${storyId} has no text`);
  if (!story.audioUrl) throw new Error(`UserStory ${storyId} has no audioUrl`);

  const { payload, segments } = await alignStoryAudio({
    text: story.text,
    title: story.title,
    audioUrl: story.audioUrl,
    language: story.language,
    storyId,
  });

  if (segments.length === 0) {
    throw new Error("Aeneas alignment produced 0 segments");
  }

  await prisma.userStory.update({
    where: { id: storyId },
    data: { audioSegments: segments as unknown as object },
  });

  return { segmentCount: segments.length, audioDurationSec: payload.audioDurationSec };
}

async function alignStoryAudio(args: {
  text: string;
  title: string | null;
  audioUrl: string;
  language: string;
  storyId: string;
}): Promise<{ payload: AudioWordTimingsPayload; segments: AudioSegment[] }> {
  const storyPlainText = extractStoryPlainText(args.text);
  if (!storyPlainText) throw new Error(`Story ${args.storyId} plain text is empty after stripping`);

  const { fullText, bodyOffset } = buildAlignmentText(args.title ?? "", storyPlainText);

  const { audioDurationSec, tokens } = await alignAudioOnModal({
    audioUrl: args.audioUrl,
    plainText: fullText,
    language: args.language,
  });

  if (tokens.length === 0) {
    throw new Error("Modal align returned zero usable tokens");
  }

  // Strip title-prefix tokens. Body-relative charOffsets, absolute sec.
  const bodyTokens: StoryWordToken[] = tokens
    .filter((t) => t.charStart >= bodyOffset)
    .map((t) => ({
      text: t.text,
      charStart: t.charStart - bodyOffset,
      charEnd: t.charEnd - bodyOffset,
      startSec: t.startSec,
      endSec: t.endSec,
    }));

  if (bodyTokens.length === 0) {
    throw new Error("Modal align returned no body tokens after stripping title prefix");
  }

  const payload: AudioWordTimingsPayload = {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec,
    storyPlainText,
    words: bodyTokens,
  };

  const segments = deriveSegmentsFromBodyTokens(storyPlainText, bodyTokens);
  return { payload, segments };
}

function deriveSegmentsFromBodyTokens(
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
function clampSegmentEndsToNextStart(segments: AudioSegment[]): AudioSegment[] {
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

export function coerceAudioWordTimings(raw: unknown): AudioWordTimingsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== AUDIO_WORD_TIMINGS_VERSION) return null;
  if (typeof record.storyPlainText !== "string") return null;
  if (!Array.isArray(record.words)) return null;

  const words: StoryWordToken[] = [];
  for (const item of record.words) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    if (typeof w.text !== "string") continue;
    if (typeof w.charStart !== "number" || typeof w.charEnd !== "number") continue;
    const startSec =
      typeof w.startSec === "number" && Number.isFinite(w.startSec) ? w.startSec : null;
    const endSec = typeof w.endSec === "number" && Number.isFinite(w.endSec) ? w.endSec : null;
    words.push({
      text: w.text,
      charStart: w.charStart,
      charEnd: w.charEnd,
      startSec,
      endSec,
    });
  }
  if (words.length === 0) return null;

  const audioDurationSec =
    typeof record.audioDurationSec === "number" && Number.isFinite(record.audioDurationSec)
      ? record.audioDurationSec
      : null;

  return {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec,
    storyPlainText: record.storyPlainText,
    words,
  };
}
