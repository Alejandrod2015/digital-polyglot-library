import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const only = process.argv.slice(3);
  const j = await p.journey.findUnique({ where: { id } });
  const orden = ((j as never as Record<string, unknown>).topics as string[]) ?? [];
  const rows = await p.journeyStory.findMany({ where: { journeyId: id }, select: { topic: true, slotIndex: true, slug: true, title: true, synopsis: true, text: true, vocab: true } });
  rows.sort((x, y) => (orden.indexOf(x.topic) - orden.indexOf(y.topic)) || (x.slotIndex - y.slotIndex));
  for (const r of rows) {
    if (only.length && !only.includes(r.slug!)) continue;
    console.log(`\n########## ${r.topic}#${r.slotIndex} · ${r.slug}\nTITULO: ${r.title}\nSINOPSIS: ${r.synopsis}\n---\n${r.text}\n---\nVOCAB: ${(r.vocab as Array<{word:string;surface?:string;type?:string;definition?:string}>).map(v=>`${v.word}${v.surface&&v.surface!==v.word?`(${v.surface})`:""} [${v.type}] ${v.definition}`).join("\n       ")}`);
  }
})().finally(() => p.$disconnect());
