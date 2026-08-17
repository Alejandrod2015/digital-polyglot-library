import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const rows: { len: number; src: string; text: string }[] = [];
  // Curated persisted exercises (published stories)
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published" } },
    select: { exercises: { select: { type: true, sentence: true, payload: true } } },
  });
  for (const s of sets) for (const ex of s.exercises) {
    const cand = [ex.sentence, (ex.payload as Record<string, unknown> | null)?.audioClip && ((ex.payload as Record<string, unknown>).audioClip as Record<string, unknown>).sentence];
    for (const c of cand) if (typeof c === "string" && c.trim()) rows.push({ len: c.trim().length, src: `curated/${ex.type}`, text: c.trim() });
  }
  // Favorites exampleSentence (client-generated exercises)
  const favs = await p.favorite.findMany({ select: { word: true, exampleSentence: true } });
  for (const f of favs) if (f.exampleSentence?.trim()) rows.push({ len: f.exampleSentence.trim().length, src: `favorito/${f.word}`, text: f.exampleSentence.trim() });

  const seen = new Set<string>();
  const uniq = rows.filter((r) => (seen.has(r.text) ? false : (seen.add(r.text), true)));
  uniq.sort((a, b) => b.len - a.len);
  console.log("TOP 10 oraciones más largas en ejercicios:\n");
  uniq.slice(0, 10).forEach((r, i) => console.log(`${i + 1}. [${r.len} chars] (${r.src})\n   ${r.text}\n`));
  // distribución
  const buckets = [80, 120, 160, 200, 300];
  console.log("Distribución (todas, únicas =", uniq.length, "):");
  let prev = 0;
  for (const b of buckets) { console.log(`  ${prev}-${b}: ${uniq.filter((r) => r.len > prev && r.len <= b).length}`); prev = b; }
  console.log(`  >${prev}: ${uniq.filter((r) => r.len > prev).length}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
