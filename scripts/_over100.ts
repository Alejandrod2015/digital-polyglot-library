import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { extractExampleSentence } from "../src/lib/exampleSentence";
const p = new PrismaClient();
const LIMIT = 100;

async function main() {
  const out: { len: number; journey: string; story: string; type: string; text: string }[] = [];

  // CURADOS (published)
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published" } },
    select: { story: { select: { slug: true, journey: { select: { name: true } } } }, exercises: { select: { type: true, sentence: true } } },
  });
  for (const s of sets) for (const ex of s.exercises) {
    const t = (ex.sentence || "").trim();
    if (t.length > LIMIT) out.push({ len: t.length, journey: s.story?.journey?.name ?? "?", story: s.story?.slug ?? "?", type: `curado/${ex.type}`, text: t });
  }

  // FAVORITOS (oración de la palabra)
  const favs = await p.favorite.findMany({ select: { word: true, exampleSentence: true, storySlug: true } });
  const journeyIdToName = new Map<string, { name: string; slug: string | null }>();
  const ids = favs.map((f) => f.storySlug).filter((s): s is string => !!s && s.startsWith("journey-")).map((s) => s.slice(8));
  if (ids.length) {
    const rows = await p.journeyStory.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, journey: { select: { name: true } } } });
    for (const r of rows) journeyIdToName.set(r.id, { name: r.journey?.name ?? "?", slug: r.slug });
  }
  for (const f of favs) {
    const one = (extractExampleSentence(f.exampleSentence, f.word) || "").trim();
    if (one.length > LIMIT) {
      let journey = "?", story = f.storySlug ?? "?";
      if (f.storySlug?.startsWith("journey-")) { const j = journeyIdToName.get(f.storySlug.slice(8)); if (j) { journey = j.name; story = j.slug ?? story; } }
      out.push({ len: one.length, journey, story, type: `favorito/${f.word}`, text: one });
    }
  }

  out.sort((a, b) => b.len - a.len);
  console.log(`Ejercicios con oración > ${LIMIT} chars: ${out.length}\n`);
  for (const r of out) console.log(`[${r.len}] ${r.journey} / ${r.story} (${r.type})\n   ${r.text}\n`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
