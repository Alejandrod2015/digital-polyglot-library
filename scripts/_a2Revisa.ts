/** Aplica una tanda de revision de glosas del A2: corrige las que traen otro
 *  sentido y marca como leidas TODAS las palabras de la tanda. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
(async () => {
  const { palabras, correcciones } = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as {
    palabras: string[]; correcciones: Record<string, { g: string; t?: string }>;
  };
  const set = new Set(palabras.map((x) => x.toLowerCase()));
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  let leidas = 0, corregidas = 0;
  for (const r of rows) {
    const g: any = { ...(r.glosses as any ?? {}) }; let toca = false;
    for (const [k, v] of Object.entries<any>(g)) {
      const kk = k.toLowerCase();
      if (!set.has(kk)) continue;
      const fix = correcciones[kk];
      if (fix) { g[k] = { ...v, g: fix.g, ...(fix.t ? { t: fix.t } : {}), rev: true }; corregidas++; }
      else if (v?.rev === false) { g[k] = { ...v, rev: true }; leidas++; }
      toca = true;
    }
    if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: r.slug } }, data: { glosses: g } });
  }
  console.log(`leidas ${leidas} · corregidas ${corregidas}`);
})().finally(() => p.$disconnect());
