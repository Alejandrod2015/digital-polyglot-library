import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
(async () => {
  const rows = await p.journeyStory.findMany({ where: { slug: { in: process.argv.slice(2) } }, select: { slug: true, audioFragments: true, audioUrl: true } });
  const orden = process.argv.slice(2);
  rows.sort((a, b) => orden.indexOf(a.slug!) - orden.indexOf(b.slug!));
  for (const r of rows) {
    const fr = (r.audioFragments ?? []) as Array<{ endSec: number }>;
    console.log(`${r.slug}\t${fr.length ? mmss(Math.max(...fr.map((f) => f.endSec))) : "-"}\t${r.audioUrl ? "ok" : "sin audio"}`);
  }
  await p.$disconnect();
})();
