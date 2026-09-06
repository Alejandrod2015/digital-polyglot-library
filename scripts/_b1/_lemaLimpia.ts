/** Tres bloques quedaron con el tiempo repetido en el lema porque su tabla no
 *  se rehizo en esta pasada. Se les quita el parentesis: el distintivo ya lo dice. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let toco = false;
    for (const e of Object.values(g)) {
      if (!e.f?.mood) continue;
      const l = String(e.f.lemma ?? "");
      const limpio = l.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (limpio && limpio !== l) { e.f.lemma = limpio; n++; toco = true; }
    }
    if (toco) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`lemas limpiados: ${n}`);
  await p.$disconnect();
})();
