/** SOLO LECTURA: dump del journey PT publicado (temas, títulos, sinopsis, vocab). */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const js = await p.journey.findMany({
    where: { language: { in: ["portuguese", "pt", "Portuguese", "pt-BR", "portugues"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, topics: true, status: true, storiesPerTopic: true },
  });
  console.log("JOURNEYS PT:", JSON.stringify(js, null, 2));

  const live = js.find((j) => j.status === "active");
  if (!live) return;

  const stories = await p.journeyStory.findMany({
    where: { journeyId: live.id },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: {
      id: true, level: true, topic: true, slotIndex: true, status: true,
      title: true, slug: true, synopsis: true, wordCount: true, vocabCount: true,
      arcType: true, audioUrl: true, coverUrl: true, vocab: true,
    },
  });
  console.log("\n=== 21 HISTORIAS ===");
  for (const s of stories) {
    console.log(`[${s.topic} #${s.slotIndex}] (${s.status}, ${s.level}, wc=${s.wordCount}, vocab=${s.vocabCount}, arc=${s.arcType}) ${s.title}`);
    console.log(`   syn: ${s.synopsis}`);
  }

  console.log("\n=== VOCAB SAMPLE (3 historias) ===");
  for (const s of [stories[0], stories[7], stories[16]].filter(Boolean)) {
    console.log(`--- ${s.title} ---`);
    console.log(JSON.stringify(s.vocab, null, 2).slice(0, 2500));
  }

  console.log("\n=== TEXTOS COMPLETOS (3) ===");
  const full = await p.journeyStory.findMany({
    where: { id: { in: [stories[0].id, stories[10].id, stories[20].id] } },
    select: { title: true, topic: true, slotIndex: true, text: true, wordCount: true },
  });
  for (const f of full) {
    console.log(`\n########## ${f.title} (${f.topic} #${f.slotIndex}, ${f.wordCount} palabras) ##########`);
    console.log(f.text);
  }

  const wc = stories.map((s) => s.wordCount ?? 0);
  console.log("\nWORDCOUNT total:", wc.reduce((a, b) => a + b, 0), "min:", Math.min(...wc), "max:", Math.max(...wc));
}

main().finally(() => p.$disconnect());
