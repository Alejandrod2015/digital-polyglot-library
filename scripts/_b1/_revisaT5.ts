/** Lectura de las 61 copias del tema 5 contra su frase. Diez traian otro
 *  sentido o la grafia de otro ingles: `nombre` decia "name; no way",
 *  `rodeos` "beating around bush" y `oido` era el organo sobre un "ha oido". */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  he:       { g: "he puesto, I have given (haber)" },
  "oído":   { g: "ha oído, has heard (oír)", t: "verb" },
  fuera:    { g: "outside", t: "adverb" },
  color:    { g: "colour" },
  nombre:   { g: "name", t: "noun" },
  vuelto:   { g: "ha vuelto a, has done it again (volver a)" },
  rodeos:   { g: "sin rodeos, straight out, without going round it" },
  vecinos:  { g: "neighbours (vecino)", t: "noun" },
  "vacío":  { g: "empty", t: "adjective" },
  quedó:    { g: "se le quedó, it stuck to him (quedarse)" },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let a = 0, m = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    if (f.slug === "") for (const [w, fix] of Object.entries(GLOBAL))
      if (g[w]) { g[w] = { ...g[w], ...fix }; a++; }
    for (const w of Object.keys(g)) if (g[w].rev === false) { g[w].rev = true; m++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`arreglos ${a} · marcadas ${m}`);
  await p.$disconnect();
})();
