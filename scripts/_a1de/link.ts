import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const a0 = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { name: true, levels: true, nextJourneyId: true } });
  console.log("A0:", a0?.name, a0?.levels, "-> nextJourneyId:", a0?.nextJourneyId);
  console.log("apunta a mi A1:", a0?.nextJourneyId === "cmqfnp3tf000032afygkqp8z2");
  // convencion de articulo en el catalogo aleman
  const rows = await p.journeyStory.findMany({ where: { journey: { language: "german", status: { not: "archived" } } }, select: { vocab: true, journey: { select: { name: true, levels: true, id: true } } } });
  const stat = new Map<string, [number, number]>();
  for (const r of rows) {
    const k = `${r.journey?.name} ${JSON.stringify(r.journey?.levels)}`;
    const [con, sin] = stat.get(k) ?? [0, 0];
    let c = con, s = sin;
    for (const v of ((r.vocab as Array<{ word?: string; type?: string }> | null) ?? [])) {
      if (v?.type !== "noun" || !v.word) continue;
      if (/^(der|die|das)\s/i.test(v.word)) c++; else s++;
    }
    stat.set(k, [c, s]);
  }
  for (const [k, [c, s]] of stat) console.log(`  ${k.padEnd(22)} sustantivos CON articulo ${c} · SIN ${s}`);
  await p.$disconnect();
})();
