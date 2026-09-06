/** Lectura de las 41 copias del tema 7 contra su frase. Nueve traian otro
 *  sentido: `caso` venia como "she obeyed him" (hacer caso) sobre "el caso es
 *  la oficina", `cuento` era el cuento de hadas sobre un "no lo cuento", y
 *  `supiera` daba la persona equivocada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  caso:      { g: "matter, the thing being talked about", t: "noun" },
  vino:      { g: "como vino, as she came (venir)", t: "verb" },
  acaba:     { g: "se acaba, runs out (acabarse)" },
  cuento:    { g: "I tell it around (contar)", t: "verb" },
  girar:     { g: "to turn, of a key (girar)" },
  dije:      { g: "I said (decir)" },
  "sé":      { g: "I know (saber)" },
  supiera:   { g: "aunque lo supiera, even if I knew (saber)" },
  confianza: { g: "trust, believing what somebody says", t: "noun" },
};
/** El trozo de `bolsa` se quedo sin la palabra al acortarlo. */
const TROZO: Record<string, Record<string, { es: string; en: string }>> = {
  "lo-que-corre-por-el-portal": { bolsa: { es: "con la bolsa en el suelo", en: "with the bag on the floor" } },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let a = 0, m = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    if (f.slug === "") for (const [w, fix] of Object.entries(GLOBAL))
      if (g[w]) { g[w] = { ...g[w], ...fix }; a++; }
    for (const [w, c] of Object.entries(TROZO[f.slug] ?? {})) if (g[w]) g[w] = { ...g[w], c };
    for (const w of Object.keys(g)) if (g[w].rev === false) { g[w].rev = true; m++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`arreglos ${a} · marcadas ${m}`);
  await p.$disconnect();
})();
