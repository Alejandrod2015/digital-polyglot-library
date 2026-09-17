/** Renombra filas tapGlossSet al slug nuevo (retitulado 2026-09-08) y
 *  actualiza la lista `slugs` de la fila global del bundle. Borra claves
 *  obsoletas de slot donde se indique. Idempotente. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const RENAMES: Record<string, string> = JSON.parse(fs.readFileSync("scripts/_b2/slug-renames.json", "utf8"));
// claves de slot que dejaron de existir con el arreglo del slot doble
const BORRA: Record<string, string[]> = { "de-medio-metro-y-gracias": ["arrancar", "arranca"] };
const solo = process.argv[2] ? process.argv[2].split(",") : null; // slugs VIEJOS a procesar
(async () => {
  const p = new PrismaClient();
  for (const [viejo, nuevo] of Object.entries(RENAMES)) {
    if (solo && !solo.includes(viejo)) continue;
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: viejo } } });
    if (fila) {
      await p.tapGlossSet.update({ where: { id: fila.id }, data: { slug: nuevo } });
      console.log(`fila ${viejo} -> ${nuevo}`);
    } else {
      const ya = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: nuevo } } });
      console.log(ya ? `fila ya en ${nuevo}` : `SIN FILA para ${viejo}`);
    }
    const f2 = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: nuevo } } });
    if (f2 && BORRA[nuevo]) {
      const g = { ...(f2.glosses as Record<string, unknown>) };
      let n = 0;
      for (const k of BORRA[nuevo]) if (k in g) { delete g[k]; n++; }
      if (n) { await p.tapGlossSet.update({ where: { id: f2.id }, data: { glosses: g as never } }); console.log(`  ${n} clave(s) obsoleta(s) borradas en ${nuevo}`); }
    }
  }
  // fila global: sustituye viejos por nuevos en `slugs`
  const glob = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } });
  if (glob) {
    const lista = (glob.slugs as string[]).map((s) => RENAMES[s] ?? s);
    await p.tapGlossSet.update({ where: { id: glob.id }, data: { slugs: lista } });
    const cambiados = (glob.slugs as string[]).filter((s) => RENAMES[s]).length;
    console.log(`fila global: ${cambiados} slug(s) actualizados de ${lista.length}`);
  }
  await p.$disconnect();
})();
