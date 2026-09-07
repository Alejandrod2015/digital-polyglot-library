/**
 * Aprieta EN SITIO el inglés de los trozos que pasan del tope, sin reescribir
 * la capa entera.
 *
 * Rehacer la capa con --rehaz habría borrado las 408 entradas de contexto que
 * el bundle ya tenía escritas a mano antes de esta tanda, y que mi troceador
 * no reproduce: sus trozos son otros. Lo que hay que tocar es el inglés de
 * los trozos concretos que se pasan, y nada más.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const B = "portuguese-traveler-brazil-b1";
const DIR = "scripts/_ctxB1";
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const fichero = `${DIR}/${f.slug}.json`;
    if (!fs.existsSync(fichero)) continue;
    const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
    const g = f.glosses as Record<string, { c?: { es?: string; en?: string } }>;
    let tocada = false;
    for (const v of Object.values(g)) {
      const es = v?.c?.es;
      if (!es || !EN[es] || EN[es] === v.c!.en) continue;
      v.c!.en = EN[es];
      tocada = true; n++;
    }
    if (!tocada) continue;
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`ingleses apretados en sitio: ${n}`);
  await p.$disconnect();
})();
