import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journey: { language: "italian", variant: "italy", status: "active" }, audioUrl: { not: null } },
    select: { slug: true, text: true, title: true, audioFragments: true },
  });
  let tp = 0, th = 0;
  for (const s of ss) {
    const fr = (s.audioFragments as Array<{ startSec: number; endSec: number }> | null) ?? [];
    if (!fr.length) continue;
    const habla = fr.reduce((a, f) => a + (f.endSec - f.startSec), 0);
    const pal = `${s.title} ${s.text}`.trim().split(/\s+/).filter(Boolean).length;
    tp += pal; th += habla;
  }
  console.log(`A0 italiano publicado: ${ss.length} historias con audio · ritmo medio ${(tp / th).toFixed(2)} pal/s`);
  await p.$disconnect();
})();
