// Shared helpers for the Audio Editor BETA: derive a list of "blocks"
// (one narrator paragraph or one dialogue line) from a JourneyStory so
// the UI can render the body organized by speaker and the segment
// regeneration endpoint can resolve which voice to use for a selection.
//
// A "block" carries:
//   - char range [startChar, endChar) inside `storyPlainText` (the same
//     coordinate space as audioWordTimings.words[i].charStart).
//   - speakerLabel ("narrator" | "Anna" | ...) for display.
//   - voiceId (with "elevenlabs/" or other engine prefix) so the
//     regenerator can call the right TTS per block.
//
// Multi-voice stories (Café in Kreuzberg style) have a `dialogueSpec`
// column with one entry per parsed dialogue segment, in the same order
// as `parseDialogueSegments(story.text)`. Single-voice stories collapse
// to a single block with the story-level voiceId.
//
// IMPORTANT: blocks EXCLUDE the speaker-label chars ("Anna: ", "Tom: ").
// Stories whose audioWordTimings were generated before stripSpeakerLabels
// became part of the alignment pipeline contain spurious tokens AT label
// positions (e.g., a "Anna" token at the position where the label "Anna:"
// sits). By making block boundaries exclude those positions, the label
// tokens fall into no block and disappear from the editor — preventing
// the "next speaker's name shows up at the end of each block" bug.

import { parseDialogueSegments } from "@/lib/elevenlabs";
import { findSpeakerLabelRanges, type SpeakerLabelRange } from "@/lib/storyPlainText";

export type AudioEditorBlock = {
  /** Index in the original speaker partition (0 = first paragraph/line). */
  index: number;
  /** Display label: "narrator" or the speaker name. */
  speakerLabel: string;
  /** Engine-qualified voice id (e.g. "elevenlabs/Ww7Sq9..."). May be null
   *  when the story has no voice configured. */
  voiceId: string | null;
  /** Char range inside the plain text returned by `extractStoryPlainText`.
   *  Boundaries EXCLUDE the leading speaker label ("Anna: ") of this
   *  segment AND the leading speaker label of the next segment, so labels
   *  belong to no block. */
  startChar: number;
  endChar: number;
};

const normWord = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

/**
 * Build editor blocks directly from the captured `audioFragments` (the
 * ground truth), one block per body fragment. Char ranges come from
 * aligning each fragment's text to `storyPlainText` at the WORD level —
 * robust where the speaker-label heuristic in `deriveAudioEditorBlocks`
 * fails (it produced empty blocks). Never yields an empty block, so every
 * section renders + is editable.
 */
export function deriveBlocksFromFragments(
  storyPlainText: string,
  bodyFragments: Array<{ speaker: string; voiceId: string | null; text: string }>,
): AudioEditorBlock[] {
  const plainTokens: { norm: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(storyPlainText)) !== null) {
    const n = normWord(m[0]);
    if (n) plainTokens.push({ norm: n, start: m.index, end: m.index + m[0].length });
  }
  const blocks: AudioEditorBlock[] = [];
  let cursor = 0;
  bodyFragments.forEach((frag, i) => {
    const fragWords = (frag.text || "").split(/\s+/).map(normWord).filter(Boolean);
    let startChar: number | null = null;
    let endChar: number | null = null;
    let j = cursor;
    for (const fw of fragWords) {
      let found = -1;
      for (let k = j; k < Math.min(plainTokens.length, j + 8); k++) {
        if (plainTokens[k].norm === fw) { found = k; break; }
      }
      if (found >= 0) {
        if (startChar === null) startChar = plainTokens[found].start;
        endChar = plainTokens[found].end;
        j = found + 1;
      }
    }
    if (startChar === null) startChar = cursor < plainTokens.length ? plainTokens[cursor].start : storyPlainText.length;
    if (endChar === null) endChar = startChar;
    blocks.push({ index: i, speakerLabel: frag.speaker || "narrator", voiceId: frag.voiceId, startChar, endChar });
    cursor = j;
  });
  return blocks;
}

type DialogueSpecEntry = { voice?: string; text?: string };

function isDialogueSpec(value: unknown): value is DialogueSpecEntry[] {
  return Array.isArray(value) && value.every((v) => v && typeof v === "object");
}

/**
 * Partition `storyPlainText` into blocks aligned with the original
 * `story.text` paragraph/dialogue structure.
 *
 * Strategy:
 *  - `parseDialogueSegments(story.text)` produces the canonical ordered
 *    list of {speaker, text} segments that drove multi-voice synthesis.
 *  - For each non-narrator segment we locate its `"Speaker: "` label
 *    range in `storyPlainText` via `findSpeakerLabelRanges` and use the
 *    range's `end` as the segment's body-start.
 *  - The segment's body-end is the next segment's LABEL start (or
 *    `plainText.length` for the last segment). Using label.start (not
 *    label.end or next segment's body-start) means the label chars are
 *    in no block — defending against legacy timings that have spurious
 *    word tokens at label positions.
 *  - voiceId comes from the matching `dialogueSpec[i]` entry; if the
 *    story is single-voice we use `story.voiceId` for every block.
 */
export function deriveAudioEditorBlocks(args: {
  storyText: string;
  storyPlainText: string;
  storyVoiceId: string | null;
  dialogueSpec: unknown;
}): AudioEditorBlock[] {
  const { storyText, storyPlainText, storyVoiceId, dialogueSpec } = args;

  const segments = parseDialogueSegments(storyText);
  const spec = isDialogueSpec(dialogueSpec) ? dialogueSpec : null;
  const labels = findSpeakerLabelRanges(storyPlainText);

  if (segments.length === 0) {
    return [
      {
        index: 0,
        speakerLabel: "narrator",
        voiceId: storyVoiceId,
        startChar: 0,
        endChar: storyPlainText.length,
      },
    ];
  }

  // For each segment find its matched speaker label (if any). Narrator
  // segments have no label.
  type SegmentInfo = { bodyStart: number; matchedLabel: SpeakerLabelRange | null };
  const segmentInfos: SegmentInfo[] = [];
  let labelCursor = 0;
  let textCursor = 0;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.speaker === "narrator") {
      segmentInfos.push({ bodyStart: textCursor, matchedLabel: null });
      continue;
    }
    let matched: SpeakerLabelRange | null = null;
    while (labelCursor < labels.length) {
      const lbl = labels[labelCursor];
      const name = storyPlainText.slice(lbl.start, lbl.end).replace(/:\s*$/, "").trim();
      if (name === segment.speaker && lbl.start >= textCursor) {
        matched = lbl;
        labelCursor++;
        break;
      }
      labelCursor++;
    }
    if (matched) {
      segmentInfos.push({ bodyStart: matched.end, matchedLabel: matched });
      textCursor = matched.end;
    } else {
      // Fallback: locate the segment's first chunk by substring.
      const snippet = segment.text.slice(0, Math.min(40, segment.text.length));
      const idx = storyPlainText.indexOf(snippet, textCursor);
      const start = idx >= 0 ? idx : textCursor;
      segmentInfos.push({ bodyStart: start, matchedLabel: null });
      textCursor = start;
    }
  }

  return segments.map((segment, i) => {
    const info = segmentInfos[i];
    let endChar = storyPlainText.length;
    if (i + 1 < segments.length) {
      const next = segmentInfos[i + 1];
      // Use the NEXT segment's label.start (not its bodyStart) so the
      // "Speaker: " chars belong to no block.
      endChar = next.matchedLabel ? next.matchedLabel.start : next.bodyStart;
    }
    const specEntry = spec?.[i];
    const voiceId =
      typeof specEntry?.voice === "string" && specEntry.voice ? specEntry.voice : storyVoiceId;
    return {
      index: i,
      speakerLabel: segment.speaker,
      voiceId,
      startChar: info.bodyStart,
      endChar,
    };
  });
}

/**
 * Find which block contains `charStart`. Returns the block index or -1
 * if nothing matches (e.g. a selection that bridges blocks — caller
 * should reject those rather than picking a random voice).
 */
export function findBlockForChar(blocks: AudioEditorBlock[], charStart: number, charEnd: number): number {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (charStart >= b.startChar && charEnd <= b.endChar) return i;
  }
  return -1;
}
