/**
 * Rellena los ultimos huecos de la capa de contexto, palabra por palabra.
 *
 * Son las que caen en trozos que el troceador descarta por llevar una sola
 * palabra tocable ("explica", "avisa", "rindo"): la frase existe, pero el
 * trozo compartido no. Aqui el trozo se escribe a mano para cada una.
 *
 *   npx tsx scripts/_pta2Huecos.ts scripts/_pta2ctx/_huecos.json
 *
 * El fichero es { "<slug>": { "<palabra>": { "es": "...", "en": "..." } } }.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const p = new PrismaClient();

(async () => {
  const datos = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as
    Record<string, Record<string, { es: string; en: string }>>;
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, Record<string, unknown>>;
  let n = 0;
  for (const [slug, palabras] of Object.entries(datos)) {
    const previa = (filas.find((f) => f.slug === slug)?.glosses ?? {}) as Record<string, Record<string, unknown>>;
    const salida = { ...previa };
    for (const [w, c] of Object.entries(palabras)) {
      salida[w] = { ...(global[w] ?? {}), ...(previa[w] ?? {}), c };
      n++;
    }
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug } },
      data: { glosses: salida as never },
    });
  }
  console.log(`huecos rellenados: ${n}`);
  await p.$disconnect();
})();
