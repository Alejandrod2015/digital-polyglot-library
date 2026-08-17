import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const jid = process.argv[2];
  const j = await prisma.journey.findUnique({ where: { id: jid } });
  const a = j as unknown as Record<string, unknown>;
  console.log(`# ${a.name} · ${a.language}/${a.variant} · ${JSON.stringify(a.levels)} · ${a.status}`);
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: jid },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const s of st) {
    const vocab = Array.isArray(s.vocab) ? (s.vocab as Record<string, unknown>[]) : [];
    const cast = (s.cast as { characters?: Record<string, unknown>[] } | null)?.characters ?? [];
    console.log(`\n\n${"=".repeat(90)}`);
    console.log(`## ${s.topic} / ${s.slotIndex} · ${s.title}`);
    console.log(`slug=${s.slug} level=${s.level} arc=${s.arcType} register=${JSON.stringify(s.register)} words=${s.wordCount} vocab=${s.vocabCount} audio=${s.audioUrl ? "SI" : "no"}`);
    console.log(`cast: ${cast.map((c) => `${c.name}(${c.role},${c.ageBand},${c.gender})`).join(", ") || "-"}`);
    console.log(`synopsis: ${s.synopsis ?? "-"}`);
    console.log(`\n${s.text ?? "(SIN TEXTO)"}`);
    console.log(`\nVOCAB (${vocab.length}):`);
    for (const v of vocab) {
      console.log(`  - ${v.word ?? v.term} [${v.type ?? "?"}] :: ${v.definition ?? v.meaning ?? v.gloss ?? "?"}`);
    }
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
