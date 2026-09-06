/** Los cuatro verbos de acotacion que entran al romper el tic "añade/remata".
 *  Van con su infinitivo entre parentesis (no tienen tabla de formas) y con su
 *  trozo en cada historia donde caen. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g: string; t: string }> = {
  explica:  { g: "explains (explicar)", t: "verb" },
  insiste:  { g: "insists (insistir)", t: "verb" },
  repite:   { g: "repeats (repetir)", t: "verb" },
  responde: { g: "answers (responder)", t: "verb" },
};
/** El trozo es la acotacion entera: quien habla y con que gesto. */
const TROZOS: Record<string, Record<string, { es: string; en: string }>> = {
  "celia-no-dice-que-si":      { explica: { es: "explica", en: "he explains" } },
  "arriba-vive-alguien":       { cuenta: { es: "cuenta", en: "he says" }, insiste: { es: "insiste", en: "he insists" } },
  "la-mayoria-decide-el-techo":{ explica: { es: "explica", en: "she explains" }, pide: { es: "pide", en: "she asks" } },
  "nuria-no-negocia":          { explica: { es: "explica", en: "she explains" }, insiste: { es: "insiste", en: "she insists" } },
  "la-cuota-no-espera":        { repite: { es: "repite", en: "he repeats" }, pide: { es: "pide", en: "he asks" } },
  "cobrar-es-otro-trabajo":    { cuenta: { es: "cuenta", en: "she says" } },
  "tres-horas-por-un-punto":   { explica: { es: "explica", en: "she explains" }, pide: { es: "pide", en: "she asks" } },
  "el-retraso-no-es-suyo":     { avisa: { es: "avisa", en: "he warns" }, insiste: { es: "insiste", en: "he insists" } },
  "reunion-sin-orden-del-dia": { responde: { es: "responde", en: "she answers" }, insiste: { es: "insiste", en: "she insists" } },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  let n = 0, m = 0;
  for (const [w, fix] of Object.entries(GLOBAL)) { global[w] = { ...global[w], ...fix, rev: true }; n++; }
  for (const w of Object.keys(global)) if (global[w].rev === false) { global[w].rev = true; m++; }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: global } });
  for (const [slug, ts] of Object.entries(TROZOS)) {
    const fila = filas.find((f) => f.slug === slug);
    if (!fila) continue;
    const g = fila.glosses as Record<string, any>;
    for (const [w, c] of Object.entries(ts)) g[w] = { ...(global[w] ?? {}), ...(g[w] ?? {}), c, rev: true };
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  console.log(`globales ${n} · marcadas ${m} · historias con trozo ${Object.keys(TROZOS).length}`);
  await p.$disconnect();
})();
