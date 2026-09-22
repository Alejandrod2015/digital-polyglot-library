/** Scratch: busca oraciones CORTAS con expresion local en cada variante ES. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();

type Seg = { index: number; text: string; startSec: number; endSec: number; normalizedText: string };
type V = { word: string; type?: string; definition?: string };

async function main() {
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] } },
    select: { id: true, name: true, variant: true, levels: true, status: true },
  });
  for (const j of js) {
    const rows = await p.journeyStory.findMany({
      where: { journeyId: j.id, audioUrl: { not: null } },
      select: { title: true, audioSegments: true, vocab: true },
    });
    const out: string[] = [];
    for (const r of rows) {
      const segs = (r.audioSegments as unknown as Seg[]) ?? [];
      const vocab = (r.vocab as unknown as V[]) ?? [];
      for (const s of segs) {
        const dur = s.endSec - s.startSec;
        if (dur < 1.8 || dur > 4.2) continue;
        const hit = vocab.find((v) => s.normalizedText?.includes(v.word.toLowerCase()));
        if (!hit) continue;
        out.push(`    ${dur.toFixed(2)}s  [${hit.type ?? "?"}] ${hit.word}  |  ${r.title}#${s.index}  ${s.text}`);
      }
    }
    if (!out.length) continue;
    console.log(`\n== ${j.name} / ${j.variant} / ${j.levels.join(",")} / ${j.status}`);
    out.sort().slice(0, 12).forEach((l) => console.log(l));
  }
  await p.$disconnect();
}
main();
