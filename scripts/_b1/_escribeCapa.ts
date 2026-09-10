// Scratch: funde trozos {palabra: {es, en, g?, t?}} en la capa de UNA historia del bundle
// B1 sin exigir que la palabra este en la glosa global (writeGlossLayer rechaza el fichero
// entero si una sola clave, como un vocab de varias palabras, no esta en la global).
// Conserva g, t, f y rev de cada entrada; solo pisa el trozo y, si se dan, g y t.
// Uso: _escribeCapa.ts <slug> <trozos.json>
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-spain-b1";
(async () => {
  const [slug, fichero] = process.argv.slice(2);
  const trozos = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, { es: string; en: string; g?: string; t?: string }>;
  const p = new PrismaClient();
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, { g: string; t: string }>;
  const fila = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!;
  const capa = fila.glosses as Record<string, Record<string, unknown>>;
  let n = 0;
  for (const [w, t] of Object.entries(trozos)) {
    const e = capa[w] ?? { g: t.g ?? glob[w]?.g, t: t.t ?? glob[w]?.t };
    e.c = { es: t.es, en: t.en };
    if (t.g) e.g = t.g;
    if (t.t) e.t = t.t;
    if (!e.g || !e.t) { console.log(`  SIN GLOSA para ${w}: no escribo esa entrada`); continue; }
    capa[w] = e; n++;
  }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: capa as never } });
  console.log(`${slug}: ${n} trozos fundidos`);
  await p.$disconnect();
})();
