/** Lectura de las 55 copias del tema 6 contra su frase. Nueve traian otro
 *  sentido: `suya` decia "as if the street were his", `cuesta` era la cuesta
 *  de una calle sobre un "lo que cuesta", y `tablon` un estante. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  suya:      { g: "theirs, of all three", t: "pronoun" },
  toca:      { g: "does work on, touches (tocar)" },
  acera:     { g: "pavement, the walkway beside the street", t: "noun" },
  cuesta:    { g: "costs (costar)", t: "verb" },
  "mío":     { g: "mine" },
  salen:     { g: "no salen las cuentas, the figures do not add up" },
  pongo:     { g: "I put it (poner)" },
  "tablón":  { g: "noticeboard, where the block pins its papers", t: "noun" },
  cuentas:   { g: "the figures, the sums (cuenta)", t: "noun" },
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
