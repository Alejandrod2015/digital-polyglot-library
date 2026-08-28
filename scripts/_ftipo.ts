/** Entradas con tabla de conjugacion pero tipo que NO es verbo: la capa
 *  corrigio el tipo y la tabla del generador se quedo detras. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const arreglar = process.argv.includes("--fix");
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { t?: string; f?: { kind?: string; link?: string; lemma?: string } }>;
    let cambio = false;
    for (const [w, e] of Object.entries(g)) {
      // Solo la CONJUGACION esta mal en un no-verbo. Las tablas de tipo
      // "line" (plural de un sustantivo, concordancia de un adjetivo) son
      // justamente de no-verbos y estan bien.
      if (!e.f || e.t === "verb") continue;
      if (e.f.kind !== "expand") continue;
      // Las tablas escritas A MANO (paradigmas de pronombre) llevan lemma con
      // barras o sin lemma: esas son correctas y se quedan. La del generador
      // tiene un infinitivo suelto, con el tiempo entre parentesis a lo sumo.
      const lemma = e.f.lemma ?? "";
      if (!/^[\p{L}]+( \((presente|pretérito|imperfecto)\))?$/u.test(lemma)) continue;
      console.log(`${f.bundle} · ${f.slug} · ${w} (${e.t})`);
      n++;
      if (arreglar) { delete e.f; cambio = true; }
    }
    if (cambio) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} entradas`);
  await p.$disconnect();
})();
