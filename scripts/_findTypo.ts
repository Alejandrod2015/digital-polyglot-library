import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const exs = await p.storyPracticeExercise.findMany({
    where: { sentence: { contains: "las puntada" } },
    select: { id: true, type: true, word: true, sentence: true, payload: true,
      set: { select: { story: { select: { id: true, slug: true, title: true } } } } },
  });
  console.log(`ejercicios con "las puntada" (sentence): ${exs.length}`);
  for (const e of exs) {
    const ac = (e.payload as any)?.audioClip;
    console.log(`  id=${e.id} [${e.type}] story=${e.set?.story?.slug}`);
    console.log(`    sentence: "${e.sentence}"`);
    console.log(`    audioClip.sentence: "${ac?.sentence ?? "(none)"}"`);
  }
  const all = await p.storyPracticeExercise.findMany({ select: { id: true, type: true, sentence: true, payload: true, set: { select: { story: { select: { slug: true } } } } } });
  const inPayload = all.filter((e) => JSON.stringify(e.payload ?? {}).includes("las puntada"));
  console.log(`\nejercicios con "las puntada" SOLO en payload JSON: ${inPayload.filter(e=>!e.sentence.includes("las puntada")).length} (total con match en payload: ${inPayload.length})`);
  for (const e of inPayload) console.log(`  id=${e.id} [${e.type}] story=${e.set?.story?.slug} sentence="${e.sentence}"`);
  const stories = await p.journeyStory.findMany({ where: { text: { contains: "las puntada" } }, select: { slug: true, title: true } });
  console.log(`\nhistorias (journeyStory.text) con "las puntada": ${stories.length}`);
  for (const s of stories) console.log(`  ${s.slug}; ${s.title}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
