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
import { extractStoryPlainText, stripSpeakerLabels } from "./storyPlainText";
import {
  AUDIO_WORD_TIMINGS_VERSION,
  coerceAudioWordTimings,
  type AudioWordTimingsPayload,
  type StoryWordToken,
} from "./audioWordTimingsTypes";
import { correctAlignmentDrift, detectSilences } from "./correctAlignmentDrift";

// Re-exportamos los tipos + parser puro para que los callers viejos
// sigan funcionando sin tocar imports. Client components deberían
// importar de `./audioWordTimingsTypes` directo para evitar arrastrar
// prisma al bundle del browser (este archivo es server-only).
export {
  AUDIO_WORD_TIMINGS_VERSION,
  coerceAudioWordTimings,
  type AudioWordTimingsPayload,
  type StoryWordToken,
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
      audioFragments: true,
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
    fragments: story.audioFragments,
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

// ── Fragment re-anchoring ────────────────────────────────────────────
// Multi-voice stories persist `audioFragments`: EXACT per-turn offsets in
// the master timeline, computed by the generator from each fragment's real
// duration + the fixed inter-turn gap (and kept in sync by the audio
// editor on every splice). aeneas, in contrast, drifts: in long stories it
// can run 0.5-1.5s late and `correctAlignmentDrift` can't pull it back
// (its backward shift is capped by the previous token's already-late end).
// Sentence clips cut from those late boundaries lose their opening words
// (la-combi-equivocada incident, 2026-07-03: "¿Esta combi va al centro?"
// marked 21.61 when the turn really starts at 19.20).
//
// When fragments exist we treat them as ground truth: tokens are bucketed
// per fragment (via char ranges in the alignment text) and remapped
// affinely so each bucket's first onset lands on frag.startSec and its
// last decay on frag.endSec. Intra-fragment relative timing (aeneas's
// strength over short spans) is preserved. Silence-based drift correction
// stays as the fallback for stories without fragments.

type FragmentAnchor = { startSec: number; endSec: number; text: string };

function coerceFragmentAnchors(value: unknown): FragmentAnchor[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const out: FragmentAnchor[] = [];
  for (const f of value as Array<Record<string, unknown>>) {
    const startSec = typeof f?.startSec === "number" ? f.startSec : NaN;
    const endSec = typeof f?.endSec === "number" ? f.endSec : NaN;
    const text = typeof f?.text === "string" ? f.text : "";
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec || !text.trim()) {
      return [];
    }
    out.push({ startSec, endSec, text });
  }
  for (let i = 1; i < out.length; i += 1) {
    if (out[i].startSec < out[i - 1].endSec - 0.01) return [];
  }
  return out;
}

/** `audioFragments` offsets live in the timeline of the file the generator
 *  concatenated (tempo=1). `applyNarrationPostProcess` renames stretched
 *  files `*_atempo<t>_<ts>.mp3`, so the tempo is recoverable from the URL;
 *  positions in the stretched file are `t0 / tempo`. */
function inferFragmentTimeScale(audioUrl: string): number {
  const m = /_atempo([0-9]*\.?[0-9]+)_/.exec(audioUrl);
  if (!m) return 1;
  const tempo = parseFloat(m[1]);
  if (!Number.isFinite(tempo) || tempo < 0.5 || tempo > 2) return 1;
  return 1 / tempo;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Locate each fragment's char range inside the alignment text, in order.
 *  Whitespace-tolerant (fragment texts collapse to single spaces, the
 *  alignment text keeps paragraph newlines). Returns null when any
 *  fragment can't be found — a sign the fragments belong to a different
 *  version of the story text, so the caller must not anchor to them. */
function locateFragmentRanges(
  fullText: string,
  fragments: FragmentAnchor[]
): Array<{ start: number; end: number }> | null {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const frag of fragments) {
    const words = frag.text.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    const re = new RegExp(words.map(escapeRegExp).join("\\s+"), "u");
    const m = re.exec(fullText.slice(cursor));
    if (!m) return null;
    const start = cursor + m.index;
    const end = start + m[0].length;
    ranges.push({ start, end });
    cursor = end;
  }
  return ranges;
}

const round3 = (n: number): number => Number(n.toFixed(3));

/** Sentence-terminal punctuation between two tokens (or attached to the
 *  end of the previous token) marks a sentence boundary inside a turn. */
const SENTENCE_BREAK_RE = /[.!?…]/;

/** Split a fragment's token indexes into sentence groups, using the
 *  punctuation found in `fullText` between consecutive tokens. Mirrors
 *  the `[.!?]+` rule of `splitStoryTextIntoSentences`. */
function groupTokensBySentence(tokens: StoryWordToken[], idxs: number[], fullText: string): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  for (let n = 0; n < idxs.length; n += 1) {
    const i = idxs[n];
    if (current.length > 0) {
      const prev = tokens[idxs[n - 1]];
      const between = fullText.slice(prev.charEnd, tokens[i].charStart);
      if (SENTENCE_BREAK_RE.test(between) || SENTENCE_BREAK_RE.test(prev.text.slice(-2))) {
        groups.push(current);
        current = [];
      }
    }
    current.push(i);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

type TimeSpan = { start: number; end: number };

/** Speech islands inside [fStart, fEnd]: the complement of the detected
 *  silences, clipped to the fragment. TTS renders pause at sentence
 *  boundaries, so islands map 1:1 to sentences when detection is clean. */
function speechIslands(fStart: number, fEnd: number, silences: TimeSpan[]): TimeSpan[] {
  const islands: TimeSpan[] = [];
  let cursor = fStart;
  for (const s of silences) {
    if (s.end <= fStart || s.start >= fEnd) continue;
    const a = Math.max(s.start, fStart);
    const b = Math.min(s.end, fEnd);
    if (a - cursor >= 0.12) islands.push({ start: cursor, end: a });
    cursor = Math.max(cursor, b);
  }
  if (fEnd - cursor >= 0.12) islands.push({ start: cursor, end: fEnd });
  return islands;
}

/** Seconds of [start, end] NOT covered by `quietSpans` (sorted). */
function activeSeconds(start: number, end: number, quietSpans: TimeSpan[]): number {
  let covered = 0;
  for (const s of quietSpans) {
    const a = Math.max(s.start, start);
    const b = Math.min(s.end, end);
    if (b > a) covered += b - a;
  }
  return Math.max(0, end - start - covered);
}

/** End of the last loud region inside [start, end], or null when none. */
function lastActiveEnd(start: number, end: number, quietSpans: TimeSpan[]): number | null {
  let cursor = start;
  let last: number | null = null;
  for (const s of quietSpans) {
    if (s.end <= start || s.start >= end) continue;
    const a = Math.max(s.start, start);
    if (a - cursor > 0.02) last = a;
    cursor = Math.max(cursor, Math.min(s.end, end));
  }
  if (end - cursor > 0.02) last = end;
  return last;
}

/** The stored fragment offsets drift EARLY on long stories: the master is
 *  stream-copy concatenated, so every seam gains ~90ms of mp3 encoder
 *  delay/padding that `probeMp3DurationSec` never sees (measured: +1.7s
 *  over 18 seams on la-combi-equivocada). The claimed boundaries are
 *  still an excellent prior: walking fragments in order, the expected
 *  start (claimed + accumulated offset) lands inside the real seam
 *  silence, so we snap each start to that silence's end (the true speech
 *  onset) and carry the correction forward. Ends snap to the next seam's
 *  silence start. Returns null when the claimed offsets stop looking like
 *  this audio at all. */
function snapFragmentBoundaries(
  fragments: FragmentAnchor[],
  timeScale: number,
  silences: TimeSpan[],
  audioDurationSec: number | null
): TimeSpan[] | null {
  const eff: TimeSpan[] = [];
  const seamStarts: Array<number | null> = [];
  let offset = 0;
  for (let f = 0; f < fragments.length; f += 1) {
    const claimedStart = fragments[f].startSec * timeScale;
    const expected = claimedStart + offset;
    const prevStart = eff.length > 0 ? eff[eff.length - 1].start : -Infinity;
    const hit = silences.find(
      (s) => expected >= s.start - 0.25 && expected <= s.end + 0.25 && s.end > prevStart
    );
    let start = expected;
    if (hit) {
      start = hit.end;
      offset = start - claimedStart;
    }
    if (Math.abs(offset) > 5) return null;
    seamStarts.push(hit ? hit.start : null);
    eff.push({ start, end: fragments[f].endSec * timeScale + offset });
  }
  for (let f = 0; f < eff.length; f += 1) {
    // The seam silence that anchors fragment f+1 marks where fragment f's
    // speech really stopped.
    const nextSeam = f + 1 < seamStarts.length ? seamStarts[f + 1] : null;
    if (nextSeam !== null && nextSeam > eff[f].start + 0.2) eff[f].end = nextSeam;
    if (audioDurationSec !== null) eff[f].end = Math.min(eff[f].end, audioDurationSec);
    if (eff[f].end <= eff[f].start) eff[f].end = eff[f].start + 0.2;
  }
  return eff;
}

/** Affine-remap the timed tokens in `idxs` from their own span onto
 *  [tStart, tEnd]. Returns false (no mutation) when the stretch factor is
 *  implausible, so callers can fall back to a coarser anchor. */
function remapSpan(
  tokens: StoryWordToken[],
  out: StoryWordToken[],
  idxs: number[],
  timed: number[],
  tStart: number,
  tEnd: number
): boolean {
  const aStart = tokens[timed[0]].startSec as number;
  const lastTok = tokens[timed[timed.length - 1]];
  const aEnd = Math.max(lastTok.endSec ?? (lastTok.startSec as number), aStart);
  const aSpan = aEnd - aStart;
  const tSpan = tEnd - tStart;

  let map: (t: number) => number;
  if (aSpan < 0.05) {
    // Degenerate source span (single collapsed token) → plain shift,
    // capped so nothing escapes past the target end.
    const offset = tStart - aStart;
    map = (t) => Math.min(t + offset, tEnd);
  } else {
    // An implausible stretch means this target doesn't actually hold this
    // token run (e.g. a spurious 0.2s "island" for a 10-word sentence).
    // Refuse so the caller can fall back to a coarser anchor.
    const k = tSpan / aSpan;
    if (k < 0.33 || k > 3) return false;
    map = (t) => tStart + (t - aStart) * k;
  }
  for (const i of idxs) {
    const t = tokens[i];
    if (typeof t.startSec === "number") out[i].startSec = round3(map(t.startSec));
    if (typeof t.endSec === "number") out[i].endSec = round3(map(t.endSec));
  }
  return true;
}

export function reanchorTokensToFragments(args: {
  tokens: StoryWordToken[];
  fullText: string;
  fragments: FragmentAnchor[];
  /** Maps the fragment timeline to the aligned audio's timeline (1/tempo
   *  for atempo-stretched masters; 1 otherwise). */
  timeScale: number;
  /** ffmpeg-detected silences (≈ -35dB, ≥0.3s). Used to (a) snap the
   *  drifted fragment boundaries onto the real inter-turn seams, and
   *  (b) split turns into speech islands so sentences inside a turn get
   *  their own exact spans. Optional; without it the claimed boundaries
   *  are used as-is. */
  silences?: TimeSpan[];
  /** Harder-threshold quiet spans (≈ -25dB, ≥0.15s). Speech peaks well
   *  above -25dB, so a "speech island" fully quiet at -25dB is actually
   *  reverb/noise tail (e.g. the master's end padding) and must not be
   *  assigned a sentence. Optional. */
  quietSpans?: TimeSpan[];
  audioDurationSec?: number | null;
}): StoryWordToken[] | null {
  const { tokens, fullText, fragments, timeScale } = args;
  const silences = args.silences ?? [];
  const quietSpans = args.quietSpans ?? [];
  const ranges = locateFragmentRanges(fullText, fragments);
  if (!ranges) return null;

  // Bucket tokens per fragment: a token belongs to fragment f until the
  // next fragment's range starts. Tokens are in char order, so a single
  // forward cursor is enough.
  const buckets: number[][] = fragments.map(() => []);
  let fi = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    while (fi < ranges.length - 1 && tokens[i].charStart >= ranges[fi + 1].start) fi += 1;
    buckets[fi].push(i);
  }

  // Correct the claimed boundaries against the real seam silences.
  const bounds =
    silences.length > 0
      ? snapFragmentBoundaries(fragments, timeScale, silences, args.audioDurationSec ?? null)
      : fragments.map((frag) => ({ start: frag.startSec * timeScale, end: frag.endSec * timeScale }));
  if (!bounds) return null;

  const out: StoryWordToken[] = tokens.map((t) => ({ ...t }));
  for (let f = 0; f < fragments.length; f += 1) {
    const idxs = buckets[f];
    const timed = idxs.filter((i) => typeof tokens[i].startSec === "number");
    if (timed.length === 0) continue;
    const fStart = bounds[f].start;
    let fEnd = bounds[f].end;
    // Trim trailing non-speech (reverb/noise above -35dB but dead at
    // -25dB), so the last sentence's end doesn't absorb the tail.
    if (quietSpans.length > 0) {
      const speechEnd = lastActiveEnd(fStart, fEnd, quietSpans);
      if (speechEnd !== null && speechEnd > fStart + 0.2) fEnd = Math.min(fEnd, speechEnd + 0.15);
    }

    // Fine anchor: one speech island per sentence. Only when the counts
    // agree and every island carries real speech energy; otherwise the
    // detection is untrustworthy for this turn (ambient bed, missing
    // pause, noise tail) and we use the coarse whole-fragment anchor.
    let anchored = false;
    const sentences = groupTokensBySentence(tokens, timed, fullText);
    if (sentences.length > 0 && silences.length > 0) {
      const islands = speechIslands(fStart, fEnd, silences).filter(
        (island) => quietSpans.length === 0 || activeSeconds(island.start, island.end, quietSpans) >= 0.1
      );
      if (islands.length === sentences.length) {
        anchored = sentences.every((sentenceIdxs, k) =>
          remapSpan(tokens, out, sentenceIdxs, sentenceIdxs, islands[k].start, islands[k].end)
        );
      }
    }

    if (!anchored && !remapSpan(tokens, out, idxs, timed, fStart, fEnd)) {
      // A stretch this far off means the fragments don't describe this
      // audio (stale offsets, wrong file). Refuse to anchor at all.
      return null;
    }
  }

  // No zero-duration tokens: downstream sentence matching
  // (`buildTranscriptTokensFromWords`) DROPS them, and which tokens get
  // dropped changes the LCS path — sentence boundaries then jump around
  // depending on rounding. A 20ms floor keeps every token matchable.
  for (const t of out) {
    if (typeof t.startSec === "number" && typeof t.endSec === "number" && t.endSec <= t.startSec) {
      t.endSec = round3(t.startSec + 0.02);
    }
  }
  return out;
}

export async function alignStoryAudio(args: {
  text: string;
  title: string | null;
  audioUrl: string;
  language: string;
  storyId: string;
  /** Raw `JourneyStory.audioFragments` JSON (exact per-turn offsets from
   *  the multi-voice generator). When valid, tokens are re-anchored to
   *  these instead of relying on silence-based drift correction. */
  fragments?: unknown;
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

  // Pass 1 — silence anchoring. aeneas distributes tokens LINEARLY inside
  // each block, so the real pauses between speaker turns / paragraphs make
  // it place post-pause tokens earlier than they're actually spoken (e.g.
  // it ended Pilar's "importante" at 28.56s when the real silence is
  // 28.96→29.72s, so the editor cut mid-word). Re-anchor tokens to
  // ffmpeg-detected silences. This fixes the RELATIVE layout inside long
  // turns; any global lateness it can't undo is handled by pass 2.
  // Needs local ffmpeg; if unavailable (e.g. Vercel runtime) we keep the
  // raw aeneas timings rather than fail the whole alignment.
  let alignedTokens = tokens;
  try {
    const corrected = await correctAlignmentDrift({ audioUrl: args.audioUrl, tokens });
    alignedTokens = corrected.tokens;
    if (corrected.anchors.length > 0) {
      console.log(
        `[alignStoryAudio] drift-corrected ${corrected.anchors.length} anchor(s), tail offset +${corrected.totalOffsetApplied.toFixed(2)}s for ${args.storyId}`,
      );
    }
  } catch (err) {
    console.warn(`[alignStoryAudio] drift correction skipped (${err instanceof Error ? err.message : err}); using raw aeneas timings`);
  }

  // Pass 2 — exact per-turn offsets from the generator (`audioFragments`).
  // See the fragment re-anchoring block comment above. Runs AFTER silence
  // anchoring on purpose: pass 1 fixes intra-turn distribution, this pass
  // pins each turn's boundaries to ground truth (silence anchoring alone
  // cannot pull a globally-late alignment back).
  const fragmentAnchors = coerceFragmentAnchors(args.fragments);
  if (fragmentAnchors.length > 0) {
    const timeScale = inferFragmentTimeScale(args.audioUrl);
    const lastEnd = fragmentAnchors[fragmentAnchors.length - 1].endSec * timeScale;
    // The master's duration must plausibly match the fragments' span
    // (allow encoder/loudnorm tail silence). If not, the offsets belong to
    // a different render and anchoring to them would corrupt everything.
    const durationOk =
      audioDurationSec === null ||
      (lastEnd <= audioDurationSec + 0.75 && lastEnd >= audioDurationSec - 8);
    if (!durationOk) {
      console.warn(
        `[alignStoryAudio] fragments end at ${lastEnd.toFixed(2)}s but audio lasts ${audioDurationSec?.toFixed(2)}s for ${args.storyId}; ignoring stale fragments`,
      );
    } else {
      // Finer-grained silences than pass 1's (0.3s vs 0.5s): intra-turn
      // sentence pauses in TTS renders sit in the 0.3-0.5s band. The -25dB
      // set separates real speech from reverb/noise tails. Best effort;
      // without ffmpeg the island snapping is skipped.
      let fineSilences: TimeSpan[] = [];
      let quietSpans: TimeSpan[] = [];
      try {
        fineSilences = await detectSilences(args.audioUrl, { minDurationSec: 0.3 });
        quietSpans = await detectSilences(args.audioUrl, { thresholdDb: -25, minDurationSec: 0.15 });
      } catch {
        // no ffmpeg (e.g. Vercel runtime) → fragment-level anchoring only
      }
      const reanchored = reanchorTokensToFragments({
        tokens: alignedTokens,
        fullText,
        fragments: fragmentAnchors,
        timeScale,
        silences: fineSilences,
        quietSpans,
        audioDurationSec,
      });
      if (reanchored) {
        alignedTokens = reanchored;
        console.log(
          `[alignStoryAudio] re-anchored tokens to ${fragmentAnchors.length} fragment offset(s) (timeScale=${timeScale.toFixed(3)}) for ${args.storyId}`,
        );
      } else {
        console.warn(
          `[alignStoryAudio] fragment re-anchor failed (text/offset mismatch) for ${args.storyId}; keeping silence-corrected timings`,
        );
      }
    }
  }

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

// coerceAudioWordTimings vive ahora en audioWordTimingsTypes.ts (puro
// y client-safe). Re-exportado arriba para compatibilidad.
