/** Una plaza de vocab de tipo verbo necesita el infinitivo A LA VISTA (o una
 *  tabla de formas): la tarjeta lo pide y lint:vocab-layer lo comprueba. Va
 *  entre parentesis y en UNA palabra, que es lo que reconoce el lint. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const B = "german-friends-a2";
const p = new PrismaClient();
(async () => {
  const nuevas = JSON.parse(fs.readFileSync("scripts/_deA2/verbosVocab.json", "utf8")) as Record<string,string>;
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug:true, glosses:true } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let toca = false;
    for (const [w, texto] of Object.entries(nuevas)) if (g[w]) { g[w].g = texto; toca = true; n++; }
    if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} glosas con el infinitivo a la vista`);
  await p.$disconnect();
})();
