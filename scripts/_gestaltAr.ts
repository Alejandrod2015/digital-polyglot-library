import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-friends-argentina", NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const en = new Map<string, string[]>(), es = new Map<string, string[]>();
  let n = 0;
  for (const f of filas) for (const [k, v] of Object.entries(f.glosses as Record<string, { c?: { es: string; en: string } }>)) {
    if (!v.c) continue; n++;
    (en.get(v.c.en) ?? en.set(v.c.en, []).get(v.c.en)!).push(`${f.slug}:${k}`);
    (es.get(v.c.es) ?? es.set(v.c.es, []).get(v.c.es)!).push(`${f.slug}:${k}`);
  }
  console.log(`trozos en el bundle: ${n}, ingleses distintos: ${en.size}`);
  const rep = [...en.entries()].filter(([, v]) => new Set(v.map((x) => x.split(":")[0])).size >= 3);
  console.log(`\ningleses que se repiten en 3+ HISTORIAS distintas: ${rep.length}`);
  for (const [t, v] of rep.sort((a, b) => b[1].length - a[1].length).slice(0, 12)) console.log(`  "${t}" x${v.length}`);
  await p.$disconnect();
})();
