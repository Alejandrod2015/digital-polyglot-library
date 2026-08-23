import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id } });
  const a = j as unknown as Record<string, unknown>;
  console.log(JSON.stringify({ id: a.id, name: a.name, language: a.language, variant: a.variant, levels: a.levels, status: a.status, typeSlug: a.typeSlug, topics: a.topics, nextJourneyId: a.nextJourneyId, description: a.description }, null, 2));
  const rows = await p.journeyStory.findMany({ where: { journeyId: id }, select: { topic: true, slotIndex: true, slug: true, title: true, status: true, wordCount: true, vocabCount: true, arcType: true, synopsis: true, text: true, vocab: true } });
  const orden = (a.topics as string[]) ?? [];
  rows.sort((x, y) => (orden.indexOf(x.topic) - orden.indexOf(y.topic)) || (x.slotIndex - y.slotIndex));
  console.log(`\n${rows.length} historias`);
  for (const r of rows) {
    const w = String(r.text ?? "").trim().split(/\s+/).filter(Boolean).length;
    console.log(`${r.topic}#${r.slotIndex}  ${r.status}  ${w}w  vocab ${(r.vocab as unknown[] ?? []).length}  arc=${r.arcType ?? "-"}  ${r.slug}`);
  }
})().finally(() => p.$disconnect());
