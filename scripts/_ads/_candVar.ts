/** Scratch: oraciones enteras que contienen una expresion dada. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
type Seg = { index: number; text: string; startSec: number; endSec: number; normalizedText: string };
const NEEDLES = process.argv.slice(2);
async function main() {
  const rows = await p.journeyStory.findMany({
    where: { audioUrl: { not: null }, journey: { language: "spanish", status: { in: ["active", "draft"] } } },
    select: { title: true, audioSegments: true, journey: { select: { variant: true, levels: true, name: true } } },
  });
  for (const r of rows) {
    const segs = (r.audioSegments as unknown as Seg[]) ?? [];
    for (const s of segs) {
      const n = s.normalizedText ?? "";
      const hit = NEEDLES.find((x) => n.includes(x));
      if (!hit) continue;
      const dur = s.endSec - s.startSec;
      if (dur > 5) continue;
      console.log(`${r.journey.variant}\t${dur.toFixed(2)}s\t${r.title}#${s.index}\t${s.text}`);
    }
  }
  await p.$disconnect();
}
main();
