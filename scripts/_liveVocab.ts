import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { name: true, language: true, variant: true, status: true },
  });
  console.log("JOURNEYS ACTIVOS:", journeys.map((j) => `${j.name}(${j.language}/${j.variant})`).join(", "), "\n");

  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published", journey: { status: { notIn: ["archived", "draft"] } } } },
    select: {
      story: { select: { journey: { select: { name: true, language: true } } } },
      exercises: { select: { type: true, word: true, sentence: true } },
    },
  });

  // distinct (word|language)
  const byWord = new Map<string, { word: string; lang: string; journey: string; types: Set<string>; sentence: string }>();
  for (const s of sets) {
    const lang = s.story?.journey?.language ?? "?";
    const journey = s.story?.journey?.name ?? "?";
    for (const ex of s.exercises) {
      if (!ex.word) continue;
      const k = `${lang}::${ex.word.toLowerCase()}`;
      if (!byWord.has(k)) byWord.set(k, { word: ex.word, lang, journey, types: new Set(), sentence: ex.sentence ?? "" });
      byWord.get(k)!.types.add(ex.type);
    }
  }
  const all = [...byWord.values()];
  const byLang: Record<string, number> = {};
  for (const w of all) byLang[w.lang] = (byLang[w.lang] || 0) + 1;
  console.log("Palabras distintas de práctica en journeys vivos:", all.length);
  console.log("Por idioma:", JSON.stringify(byLang));
  console.log("Por journey:", JSON.stringify(all.reduce((a, w) => ((a[w.journey] = (a[w.journey] || 0) + 1), a), {} as Record<string, number>)));
  console.log("\nMuestra (10):");
  all.slice(0, 10).forEach((w) => console.log(`  [${w.lang}] ${w.word}  (sent actual: "${w.sentence.slice(0, 60)}")`));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
