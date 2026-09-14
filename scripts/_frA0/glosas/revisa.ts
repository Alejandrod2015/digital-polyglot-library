/** Copias de french-friends-a0 leidas contra sus frases (2026-09-11, chat de
 *  planificacion). Las que no casaban con la escena o eran parafrasis en vez de
 *  traduccion ya entraron escritas a mano (nuevas.json: corregidas y directas);
 *  las 164 que quedan casan y se marcan como leidas. Mismo molde que _ptb1Revisa.ts. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient(); const B = "french-friends-a0";
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  let leidas = 0;
  for (const r of rows) {
    const g: any = { ...((r.glosses as any) ?? {}) }; let toca = false;
    for (const [k, v] of Object.entries<any>(g)) {
      if (v?.rev !== false) continue;
      g[k] = { ...v, rev: true }; leidas++; toca = true;
    }
    if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: r.slug } }, data: { glosses: g } });
  }
  console.log(`leidas ${leidas}`);
})().finally(() => p.$disconnect());
