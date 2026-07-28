// Parallel pipeline for word-level audio highlight ("karaoke" reader).
// Lives next to existing audio/transcript helpers WITHOUT touching them.
// The legacy sentence-level path in lib/elevenlabs.ts and lib/audioSegments.ts
// keeps working unchanged for every story that does not opt into this feature.
//
// Forced alignment runs in Modal (see modal_app/audio_studio.py:align). aeneas
// inside Modal takes (mp3, plain text, language) and returns a list of word
// tokens with character offsets and start/end seconds. We persist that JSON
// directly into the JourneyStory.audioWordTimings column.

import { prisma } from "@/lib/prisma";
import {
  AUDIO_WORD_TIMINGS_VERSION,
  coerceAudioWordTimings,
  type AudioWordTimingsPayload,
  type StoryWordToken,
} from "./audioWordTimingsTypes";
import {
  alignAudioOnModal,
  alignStoryAudio,
  buildAlignmentText,
  extractStoryPlainText,
} from "./alignStoryAudio";

// Re-exportamos los tipos + parser puro para que los callers viejos
// sigan funcionando sin tocar imports. Client components deberían
// importar de `./audioWordTimingsTypes` directo para evitar arrastrar
// prisma al bundle del browser (este archivo es server-only).
// La alineación en sí vive en `alignStoryAudio.ts`, libre de prisma, para
// que los scripts puedan correrla bajo tsx (server-only bloquea lo demás).
export {
  AUDIO_WORD_TIMINGS_VERSION,
  coerceAudioWordTimings,
  type AudioWordTimingsPayload,
  type StoryWordToken,
};
export { alignAudioOnModal, alignStoryAudio, buildAlignmentText, extractStoryPlainText };

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

