// Forced alignment of a story's audio against its text.
//
// Runs in Modal (see modal_app/audio_studio.py:align): aeneas takes
// (mp3, plain text, language) and returns word tokens with character offsets
// and start/end seconds.
//
// Deliberately free of any prisma import: the DB-writing wrappers live in
// `audioWordTimings.ts`. Keeping them apart lets scripts run the alignment
// under tsx, which `server-only` (pulled in by lib/prisma) otherwise blocks.

import { extractStoryPlainText, stripSpeakerLabels } from "./storyPlainText";
import {
  AUDIO_WORD_TIMINGS_VERSION,
  type AudioWordTimingsPayload,
  type StoryWordToken,
} from "./audioWordTimingsTypes";
import { deriveSegmentsFromBodyTokens } from "./deriveAudioSegments";
import { snapSegmentEndsToSilence } from "./snapSegmentsToSilence";
import { type AudioSegment } from "./audioSegments";

export { extractStoryPlainText };

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

/**
 * Remap aeneas tokens from an "alignment text" coordinate space (the
 * version we sent to Modal, with speaker labels stripped) back to the
 * original story text (with labels). Tokens are guaranteed to appear
 * in the same order in both texts because the strip only removes whole
 * substrings, so a linear cursor + indexOf is enough.
 */
function remapTokensToOriginal(
  tokens: StoryWordToken[],
  alignmentText: string,
  originalText: string
): StoryWordToken[] {
  const out: StoryWordToken[] = [];
  let cursor = 0;
  for (const token of tokens) {
    const slice = alignmentText.slice(token.charStart, token.charEnd);
    const idx = originalText.indexOf(slice, cursor);
    if (idx < 0) continue;
    out.push({
      text: token.text,
      charStart: idx,
      charEnd: idx + slice.length,
      startSec: token.startSec,
      endSec: token.endSec,
    });
    cursor = idx + slice.length;
  }
  return out;
}

export async function alignStoryAudio(args: {
  text: string;
  title: string | null;
  audioUrl: string;
  language: string;
  storyId: string;
}): Promise<{ payload: AudioWordTimingsPayload; segments: AudioSegment[] }> {
  const storyPlainText = extractStoryPlainText(args.text);
  if (!storyPlainText) throw new Error(`Story ${args.storyId} plain text is empty after stripping`);

  // Speaker labels ("Tomás: ", "Don Beto: ") are visual cues that the
  // narrator never pronounces. Sending them to aeneas makes the
  // aligner reserve time for them and drift every subsequent word
  // forward. Strip them for alignment; the reader still gets the
  // original text (with labels) for display, and we remap each token
  // back to the original char-space after alignment.
  const { stripped: alignmentPlainText } = stripSpeakerLabels(storyPlainText);

  const { fullText, bodyOffset } = buildAlignmentText(args.title ?? "", alignmentPlainText);

  const { audioDurationSec, tokens } = await alignAudioOnModal({
    audioUrl: args.audioUrl,
    plainText: fullText,
    language: args.language,
  });

  if (tokens.length === 0) {
    throw new Error("Modal align returned zero usable tokens");
  }

  // Word timings are used RAW, exactly as aeneas returns them.
  //
  // They used to be post-processed by `correctAlignmentDrift`, which anchored
  // the first token after every detected silence to the end of that silence.
  // Measured on 2026-07-27 against whisper word onsets: that correction is
  // what made the karaoke highlight lag. Because the shift is cumulative and
  // one-directional, a SINGLE anchor pushed the whole rest of the story late
  // (+0.31 s and +0.34 s in the two stories where it could be isolated), and
  // across the library it left the highlight +0.41 s late on average with the
  // timings running ~0.75 s past the end of the audio.
  //
  // The control is unambiguous: 7 stories carry an ambient bed that never
  // dips below -35 dB, so the correction found no silences and never fired on
  // them. Those 7 kept raw aeneas timings and scored median |error| 0.12-0.16 s
  // against every other story's 0.46 s. Re-running the correction on those raw
  // timings (at a threshold that does see their pauses) reproduced the damage:
  // 0.160 s -> 0.280 s and 0.160 s -> 0.300 s.
  //
  // Raw aeneas measures at median |error| 0.17 s, which IS the noise floor of
  // the ruler (whisper base vs small disagree by 0.17 s median), so it is as
  // accurate as this setup can measure. Do not "correct" it again without a
  // ruler that can resolve better than 0.17 s.
  const alignedTokens = tokens;

  // Strip title-prefix tokens; coords are still in alignmentPlainText space.
  const bodyTokensInAlignmentSpace: StoryWordToken[] = alignedTokens
    .filter((t) => t.charStart >= bodyOffset)
    .map((t) => ({
      text: t.text,
      charStart: t.charStart - bodyOffset,
      charEnd: t.charEnd - bodyOffset,
      startSec: t.startSec,
      endSec: t.endSec,
    }));

  if (bodyTokensInAlignmentSpace.length === 0) {
    throw new Error("Modal align returned no body tokens after stripping title prefix");
  }

  // Remap from alignment text (no labels) to original text (with labels).
  // Idempotent when the original has no labels (alignmentPlainText ===
  // storyPlainText), so journey stories are unaffected by this change.
  const bodyTokens =
    alignmentPlainText === storyPlainText
      ? bodyTokensInAlignmentSpace
      : remapTokensToOriginal(bodyTokensInAlignmentSpace, alignmentPlainText, storyPlainText);

  const payload: AudioWordTimingsPayload = {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec,
    storyPlainText,
    words: bodyTokens,
  };

  // Sentence clips (practice mode) are the one consumer that needs boundaries
  // pinned to the audio rather than to aeneas's word ends; snap them here so
  // the word timings above can stay raw. Needs local ffmpeg; if it is
  // unavailable the un-snapped segments are still usable.
  const rawSegments = deriveSegmentsFromBodyTokens(storyPlainText, bodyTokens);
  let segments = rawSegments;
  if (rawSegments.length > 0) {
    const snappedResult = await snapSegmentEndsToSilence({
      audioUrl: args.audioUrl,
      segments: rawSegments,
    });
    segments = snappedResult.segments;
    if (snappedResult.reason) {
      console.warn(
        `[alignStoryAudio] segment snapping skipped (${snappedResult.reason}) for ${args.storyId}`
      );
    } else if (snappedResult.snapped > 0) {
      console.log(
        `[alignStoryAudio] snapped ${snappedResult.snapped}/${rawSegments.length} segment end(s) to real pauses for ${args.storyId}`
      );
    }
  }

  return { payload, segments };
}

// coerceAudioWordTimings vive ahora en audioWordTimingsTypes.ts (puro
// y client-safe). Re-exportado arriba para compatibilidad.
// deriveSegmentsFromBodyTokens vive en deriveAudioSegments.ts (también puro)
// para que los scripts de reparación lo usen sin arrastrar prisma.
