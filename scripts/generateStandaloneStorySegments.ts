import { config as loadEnv } from "dotenv";
import OpenAI from "openai";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import {
  alignStorySentencesToSegments,
  alignStorySentencesToWords,
  buildAudioSegmentsFromTranscript,
  TranscriptWord,
} from "@/lib/audioSegments";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug) {
    throw new Error("Usage: tsx scripts/generateStandaloneStorySegments.ts <standalone-story-slug>");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const story = await getStandaloneStoryBySlug(slug);
  if (!story) {
    throw new Error(`Standalone story not found: ${slug}`);
  }
  if (!story.audioUrl) {
    throw new Error(`Standalone story has no audioUrl: ${slug}`);
  }

  const response = await fetch(story.audioUrl);
  if (!response.ok) {
    throw new Error(`Audio fetch failed with status ${response.status}`);
  }

  const audioBytes = new Uint8Array(await response.arrayBuffer());
  const file = new File([audioBytes], `${story.slug}.mp3`, { type: "audio/mpeg" });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcript = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    prompt: story.text,
    timestamp_granularities: ["word", "segment"],
  });

  const rawSegments =
    "segments" in transcript && Array.isArray(transcript.segments) ? transcript.segments : [];
  const rawWords =
    "words" in transcript && Array.isArray(transcript.words) ? (transcript.words as TranscriptWord[]) : [];
  const transcriptSegments = buildAudioSegmentsFromTranscript(rawSegments);
  const segments =
    rawWords.length > 0
      ? alignStorySentencesToWords(story.text, rawWords, story.title)
      : alignStorySentencesToSegments(story.text, transcriptSegments, story.title);

  console.log(JSON.stringify({ slug: story.slug, audioUrl: story.audioUrl, segments }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
