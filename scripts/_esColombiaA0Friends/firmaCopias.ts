/** Firma (rev:true) las copias de hermanos que YA se leyeron contra su frase.
 *
 *  Dos cosas que costaron sangre en otros journeys:
 *
 *  1. `lint:glosses-reviewed` cuenta CADA copia en la fila global Y en la de
 *     cada historia, asi que el numero que imprime esta inflado por 3 o 4.
 *     Aqui se firma por PALABRA, en todas sus filas, y el informe dice cuantas
 *     palabras distintas son.
 *  2. Firmar a ciegas todo lo que tenga rev:false convierte el lint en un
 *     sello vacio. Este script PARA si encuentra una palabra sin leer que no
 *     esta en `leidas.json`, que es la lista que salio de
 *     `reviewCopiedGlosses.ts --pend --tsv`.
 *
 *  npx tsx scripts/_esColombiaA0Friends/firmaCopias.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();
const BUNDLE = "spanish-friends-colombia-a0";

(async () => {
  const seco = process.argv.includes("--dry");
  const leidas = new Set((JSON.parse(fs.readFileSync("scripts/_esColombiaA0Friends/leidas.json", "utf8")) as string[]).map((w) => w.toLowerCase()));
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug: true, glosses: true } });

  const sinLeer = new Set<string>();
  for (const fila of filas) {
    for (const [k, v] of Object.entries(fila.glosses as Record<string, any>)) {
      if (v?.rev === false && !leidas.has(k.toLowerCase())) sinLeer.add(k);
    }
  }
  if (sinLeer.size) {
    console.error(`PARA: ${sinLeer.size} copia(s) sin leer y fuera de leidas.json: ${[...sinLeer].sort().join(", ")}`);
    console.error("Leelas con: npx tsx scripts/reviewCopiedGlosses.ts " + BUNDLE + " --pend --tsv");
    process.exit(1);
  }

  const palabras = new Set<string>();
  let entradas = 0;
  for (const fila of filas) {
    const g = fila.glosses as Record<string, any>;
    let toco = false;
    for (const [k, v] of Object.entries(g)) {
      if (v?.rev !== false) continue;
      v.rev = true;
      palabras.add(k.toLowerCase());
      entradas++;
      toco = true;
    }
    if (toco && !seco) {
      await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: BUNDLE, slug: fila.slug } }, data: { glosses: g as never } });
    }
  }
  console.log(`${seco ? "[dry] " : ""}${palabras.size} palabra(s) distintas firmadas (${entradas} entradas contando las 21 filas de historia)`);
  await prisma.$disconnect();
})();
