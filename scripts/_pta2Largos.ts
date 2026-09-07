/** Los trozos del A2 PT cuyo ingles pasa del tope (PT + 3 palabras), o que no
 *  salen tal cual en su oracion. Distintos, no por palabra. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const B = "portuguese-traveler-brazil-a2";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const vistos = new Map<string, { slug: string; en: string; nEs: number; nEn: number }>();
  for (const f of filas) {
    if (!f.slug) continue;
    for (const v of Object.values((f.glosses ?? {}) as Record<string, { c?: { es?: string; en?: string } }>)) {
      const es = v?.c?.es, en = v?.c?.en;
      if (!es || !en) continue;
      const nEs = es.split(/\s+/).length, nEn = en.split(/\s+/).length;
      if (nEn <= nEs + 3) continue;
      if (!vistos.has(es)) vistos.set(es, { slug: f.slug, en, nEs, nEn });
    }
  }
  for (const [es, v] of vistos)
    console.log(`${v.slug}\n  "${es}": "${v.en}"   (${v.nEs} vs ${v.nEn})`);
  console.log(`\n${vistos.size} trozos distintos por encima del tope`);
  await p.$disconnect();
})();
