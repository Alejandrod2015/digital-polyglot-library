import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id } });
  const orden = ((j as never as Record<string, unknown>).topics as string[]) ?? [];
  const rows = await p.journeyStory.findMany({ where: { journeyId: id }, select: { topic: true, slotIndex: true, slug: true, title: true, text: true } });
  rows.sort((x, y) => (orden.indexOf(x.topic) - orden.indexOf(y.topic)) || (x.slotIndex - y.slotIndex));
  for (const r of rows) console.log(`\n### ${r.topic}#${r.slotIndex} · ${r.title}\n${r.text}`);
})().finally(() => p.$disconnect());
