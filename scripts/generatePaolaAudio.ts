/**
 * One-off CLI: call Modal Piper synth for a JourneyStory + run the
 * narration post-process. Mirrors what /api/studio/audio/generate-local
 * does in its Modal fast path, but invoked directly without going
 * through Studio auth. Env (STUDIO_AUDIO_URL, STUDIO_AUDIO_TOKEN,
 * DATABASE_URL, MEDIA_STORAGE_*) must be loaded via `source .env`.
 *
 * Usage: tsx scripts/generatePaolaAudio.ts <storyId>
 */
import { prisma } from "../src/lib/prisma";
import { buildAudioNarrationText } from "../src/lib/elevenlabs";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

async function main() {
  const storyId = process.argv[2];
  if (!storyId) {
    console.error("Usage: tsx scripts/generatePaolaAudio.ts <storyId>");
    process.exit(2);
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story || !story.text || !story.title) throw new Error("story missing text/title");
  if (!story.voiceId) throw new Error("story missing voiceId");

  const url = process.env.STUDIO_AUDIO_URL;
  const token = process.env.STUDIO_AUDIO_TOKEN;
  if (!url || !token) throw new Error("STUDIO_AUDIO_URL/TOKEN not set");

  const narration = buildAudioNarrationText(story.title, story.text);
  const baseFilename = `${story.slug}_${Date.now()}`;

  console.log(`Story: ${story.title} (${storyId})`);
  console.log(`Voice: ${story.voiceId}`);

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioStatus: "generating" },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      _token: token,
      text: narration,
      voiceId: story.voiceId,
      filename: baseFilename,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Modal ${res.status}: ${detail.slice(0, 300)}`);
  }
  const result = await res.json() as { url: string; filename: string; bytes: number };
  console.log(`Modal raw:  ${result.url}  (${result.bytes} bytes)`);

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      audioUrl: result.url,
      audioFilename: result.filename,
      audioSegments: [],
      audioStatus: "ready",
    },
  });

  console.log("Running narration post-process (atempo + ambient + alignment)...");
  const post = await applyNarrationPostProcess({
    storyId,
    sourceUrl: result.url,
  });
  console.log(`Final:      ${post.audioUrl}`);
  console.log(`Applied:    atempo=${post.appliedTempo}, ambientTag=${post.appliedAmbientTag ?? "(none)"}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    try {
      const storyId = process.argv[2];
      if (storyId) {
        await prisma.journeyStory.update({
          where: { id: storyId },
          data: { audioStatus: "failed" },
        }).catch(() => undefined);
      }
    } finally {
      await prisma.$disconnect();
      process.exit(1);
    }
  });
