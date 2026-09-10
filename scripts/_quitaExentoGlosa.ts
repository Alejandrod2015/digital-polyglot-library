/**
 * Quita de un bundle la glosa de una palabra que ESTA EXENTA en
 * scripts/tap-gloss-exempt.json (articulo, numeral, personaje o lugar): del
 * mapa global (slug "") y de todas las capas de historia del bundle.
 *
 *   npx tsx scripts/_quitaExentoGlosa.ts <bundle> <palabra> [--apply]
 *
 * Sin --apply solo lista lo que borraria. Se niega si la palabra no esta en la
 * fila de exentos de ESE bundle: es la unica razon por la que una glosa tocable
 * puede desaparecer sin dejar la palabra muerta (lint:gloss-variants la marca
 * como "exento: no debe tener glosa"; rebuildTapGlosses no la vuelve a pedir).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
(async () => {
  const [bundle, palabraArg] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  if (!bundle || !palabraArg) { console.error("uso: _quitaExentoGlosa.ts <bundle> <palabra> [--apply]"); process.exit(2); }
  const palabra = palabraArg.toLowerCase();
  const e = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[bundle];
  const exentos = new Set<string>(
    [...(e?.articles ?? []), ...(e?.numerals ?? []), ...(e?.characterNames ?? []), ...(e?.placeNames ?? [])].map((w: string) => w.toLowerCase()),
  );
  if (!exentos.has(palabra)) { console.error(`"${palabra}" no esta exenta en ${bundle}; no borro nada`); process.exit(1); }

  const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, glosses: true } });
  let n = 0;
  for (const f of filas) {
    const g = { ...(f.glosses as Record<string, unknown>) };
    const claves = Object.keys(g).filter((k) => k.toLowerCase() === palabra);
    if (!claves.length) continue;
    for (const k of claves) { console.log(`slug="${f.slug}" ${k}: ${JSON.stringify(g[k])}`); delete g[k]; n++; }
    if (apply) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} entrada(s) ${apply ? "borradas" : "a borrar (dry)"}`);
})().finally(() => p.$disconnect());
