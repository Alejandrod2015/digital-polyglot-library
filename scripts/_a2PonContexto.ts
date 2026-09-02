/** Escribe el contexto (frase + ingles) de las palabras que lo tenian vacio,
 *  en la fila de SU historia. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
(async () => {
  const EN = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Record<string, Record<string, string>>;
  const faltan = JSON.parse(fs.readFileSync(process.argv[3], "utf8")) as Record<string, Record<string, any>>;
  let n = 0;
  for (const [slug, ws] of Object.entries(EN)) {
    const row = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } }, select: { glosses: true } });
    const g: any = { ...(row!.glosses as any ?? {}) };
    const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } }, select: { glosses: true } }))!.glosses as any;
    for (const [k, en] of Object.entries(ws)) {
      const es = faltan[slug]?.[k]?.es;
      if (!es) { console.warn(`  sin ventana: ${slug}/${k}`); continue; }
      g[k] = { ...(g[k] ?? { g: glob[k]?.g, t: glob[k]?.t }), c: { es, en } };
      n++;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  console.log(`contextos escritos: ${n}`);
})().finally(() => p.$disconnect());
