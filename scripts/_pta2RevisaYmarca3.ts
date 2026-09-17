/** Las dos ultimas copias del tema 2, leidas y marcadas. "estrada" venia como
 *  "road" a secas y aqui es la expresion: estar na estrada es andar de viaje. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  estrada: { g: "road; na estrada means away travelling" },
};

(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { g?: string; t?: string; rev?: boolean }>;
    for (const [w, fix] of Object.entries(ARREGLOS))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g))
      if (g[w]?.rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug: f.slug } },
      data: { glosses: g as never },
    });
  }
  console.log(`arreglos ${arreglos} · marcadas como leidas ${marcadas}`);
  await p.$disconnect();
})();
