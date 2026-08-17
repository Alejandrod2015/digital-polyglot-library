import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  // Narración: audioUrl de historias publicadas (es + de).
  const es = await prisma.journeyStory.findFirst({
    where: { status: "published", audioUrl: { not: null }, journey: { language: "spanish" } },
    select: { slug: true, voiceId: true, audioUrl: true },
  });
  const de = await prisma.journeyStory.findFirst({
    where: { status: "published", audioUrl: { not: null }, journey: { language: "german" } },
    select: { slug: true, voiceId: true, audioUrl: true },
  });
  if (es) console.log(`NARR es | ${es.slug} | voice=${es.voiceId} | ${es.audioUrl}`);
  if (de) console.log(`NARR de | ${de.slug} | voice=${de.voiceId} | ${de.audioUrl}`);

  // Clips pre-horneados de práctica (payload.audioClip.clipUrl + wordClipUrl).
  const sets = await prisma.storyPracticeSet.findMany({
    where: { story: { status: "published" } },
    select: { exercises: { select: { payload: true } } },
    take: 40,
  });
  let clip = 0, word = 0;
  for (const s of sets) {
    for (const ex of s.exercises) {
      const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ?? null) as Record<string, unknown> | null;
      if (clip < 2 && typeof ac?.clipUrl === "string") { console.log(`PRACT-clip | voice=${ac.voiceId} | ${ac.clipUrl}`); clip++; }
      if (word < 2 && typeof ac?.wordClipUrl === "string") { console.log(`PRACT-word | voice=${ac.wordVoiceId ?? ac.voiceId} | ${ac.wordClipUrl}`); word++; }
    }
    if (clip >= 2 && word >= 2) break;
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
