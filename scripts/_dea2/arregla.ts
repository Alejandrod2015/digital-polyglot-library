/** Dos arreglos que piden los lints:
 *  1. `c.en` no puede repetir la glosa de la palabra: se reescribe la GLOSA,
 *     que es la que estaba de mas, no el trozo.
 *  2. Un numeral no es tocable: sale del bundle y entra en la fila de exentos. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "german-friends-a2";
const p = new PrismaClient();
const GLOSAS: Record<string,string> = {
  halsschmerzen: "pain in the throat that makes swallowing hard",
  klinge: "I come across as, I sound (klingen)",
  bank: "a bench to sit on outdoors",
};
const FUERA = ["zweihundert", "hundertzwanzig", "achtunddreißig", "dreißigtausend"];
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let toca = false;
    for (const [w, texto] of Object.entries(GLOSAS)) if (g[w]) { g[w].g = texto; toca = true; }
    for (const w of FUERA) if (g[w]) { delete g[w]; toca = true; }
    if (toca) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log("hecho");
  await p.$disconnect();
})();
