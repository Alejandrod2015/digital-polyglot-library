/* READ-ONLY inspection of the ambient example story. No writes. Scratch. */
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "se-fue-la-luz" },
    select: {
      id: true, slug: true, title: true, ambientTag: true,
      audioUrl: true, audioFilename: true,
      voiceProvenance: true, audioFragments: true,
      audioSegments: true,
      journey: { select: { language: true, variant: true } },
    },
  });
  if (!story) return console.log("NOT FOUND");
  const frags = Array.isArray(story.audioFragments) ? story.audioFragments as any[] : [];
  console.log(JSON.stringify({
    id: story.id, slug: story.slug, title: story.title,
    ambientTag: story.ambientTag,
    language: story.journey.language, variant: story.journey.variant,
    audioUrl: story.audioUrl,
    voiceProvenance: story.voiceProvenance,
    fragmentCount: frags.length,
    fragmentSample: frags.slice(0, 3).map((f) => ({ index: f.index, speaker: f.speaker, startSec: f.startSec, endSec: f.endSec, url: f.url, text: (f.text || "").slice(0, 40) })),
    segmentCount: Array.isArray(story.audioSegments) ? (story.audioSegments as any[]).length : 0,
  }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
