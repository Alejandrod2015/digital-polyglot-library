/** Repaso final del Traveler DE A0 sobre lo que hay EN LA BASE, no en el
 *  fichero de trabajo. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { topic: true, slotIndex: true, slug: true, title: true, synopsis: true, text: true,
              vocab: true, arcType: true, audioSegments: true, audioFragments: true, audioWordTimings: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  fs.writeFileSync(process.argv[2] ?? "/tmp/final.json", JSON.stringify(st, null, 2));
  const stale = st.filter((s) => s.audioSegments || s.audioFragments || s.audioWordTimings);
  console.log(`copias de audio desfasadas: ${stale.length}/21 (segmentos, fragmentos o karaoke)`);
  // patron de apertura: primera palabra y forma del sujeto
  const shapes: Record<string, number> = {};
  for (const s of st) {
    const f = String(s.text).split(/(?<=[.!?])\s/)[0] ?? "";
    const w = f.split(/\s+/);
    const det = /^(Der|Die|Das|Ein|Eine|Viele|Zwei|Reben|Noah|Elias)/.test(w[0] ?? "") ? w[0] : "otro";
    shapes[det] = (shapes[det] ?? 0) + 1;
  }
  console.log(`primeras palabras: ${Object.entries(shapes).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} x${v}`).join(", ")}`);
  await p.$disconnect();
})();
