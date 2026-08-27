/** Marca el artículo (der/die/das) en la capa de contexto de un bundle.
 *  npx tsx scripts/_gm.ts <bundle> <generos.json> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [bundle, fichero] = process.argv.slice(2);
  const gen = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const g = filas.find((f) => f.slug === "")!.glosses as Record<string, { t: string }>;
  // El tipo que manda es el de la CAPA cuando la historia lo corrigio: `salsa`
  // esta tipada como adjetivo en el mapa global y aqui es la salsa del mole.
  const tipoEn = (slug: string, w: string) => {
    const e = (filas.find((f) => f.slug === slug)?.glosses as Record<string, { t?: string }>)?.[w];
    return e?.t ?? g[w]?.t;
  };
  const noSustantivo = Object.keys(gen).filter((w) =>
    !filas.some((f) => f.slug !== "" && (f.glosses as Record<string, unknown>)[w] && tipoEn(f.slug, w) === "noun"));
  if (noSustantivo.length) { console.error("no son sustantivos en la global:", noSustantivo.join(", ")); process.exit(1); }
  let tocadas = 0;
  const sin = new Set<string>();
  for (const f of filas.filter((f) => f.slug !== "")) {
    const e = f.glosses as Record<string, Record<string, unknown>>;
    let cambio = false;
    for (const w of Object.keys(e)) {
      if (tipoEn(f.slug, w) !== "noun") continue;
      if (gen[w]) { e[w].gm = gen[w]; tocadas++; cambio = true; } else sin.add(w);
    }
    if (cambio) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: e as never } });
  }
  console.log(`${tocadas} sustantivos con artículo; ${sin.size} sin marcar: ${[...sin].sort().join(" ")}`);
  await p.$disconnect();
}
main();
