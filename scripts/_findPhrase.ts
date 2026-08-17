import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const NEEDLE = process.argv[2] ?? "mäßig interessiert";

async function main() {
  // 1) Practice exercises whose sentence/payload contains the phrase.
  const sets = await prisma.storyPracticeSet.findMany({
    select: { story: { select: { slug: true, status: true } }, exercises: { select: { type: true, word: true, sentence: true, payload: true } } },
  });
  console.log(`Buscando: "${NEEDLE}"\n=== en PRACTICE ===`);
  for (const s of sets) {
    for (const ex of s.exercises) {
      const blob = JSON.stringify(ex.payload ?? {}) + " " + (ex.sentence ?? "");
      if (blob.includes(NEEDLE)) {
        const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ?? null) as Record<string, unknown> | null;
        console.log(`  [${s.story?.slug} ${s.story?.status}] type=${ex.type} word=${ex.word}`);
        console.log(`     sentence=${ex.sentence}`);
        console.log(`     clipUrl=${ac?.clipUrl ?? "-"}  cachedUrl=${ac?.cachedUrl ?? "-"}  voice=${ac?.voiceId ?? "-"}`);
      }
    }
  }
  // 2) Story bodies.
  const stories = await prisma.journeyStory.findMany({
    where: { text: { contains: NEEDLE } },
    select: { slug: true, status: true, voiceId: true, audioUrl: true },
  });
  console.log(`=== en STORY BODY (text) ===`);
  for (const st of stories) console.log(`  [${st.slug} ${st.status}] voice=${st.voiceId} audioUrl=${st.audioUrl}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
