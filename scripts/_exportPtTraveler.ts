// Solo lectura: vuelca las historias de un Traveler PT-BR al formato de entrada de saveStory.ts.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [journeyId, out] = process.argv.slice(2);
  const j = await p.journey.findUniqueOrThrow({ where: { id: journeyId } });
  const rows = await p.journeyStory.findMany({ where: { journeyId }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const order = new Map(j.topics.map((t, i) => [t, i]));
  rows.sort((a, b) => (order.get(a.topic) ?? 99) - (order.get(b.topic) ?? 99) || a.slotIndex - b.slotIndex);
  const data = rows.map((r: any) => ({ topic: r.topic, slotIndex: r.slotIndex, title: r.title, slug: r.slug, synopsis: r.synopsis, text: r.text, vocab: r.vocab, arcType: r.arcType }));
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`${data.length} historias -> ${out}`);
}
main().finally(() => p.$disconnect());
