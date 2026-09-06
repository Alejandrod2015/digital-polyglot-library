/** Lectura de las 79 copias del tema 3 contra su frase. Veintiuna traian otro
 *  sentido: `dejo` venia como sustantivo ("a faint hint of feeling") sobre un
 *  "lo dejo claro", `punto` como "dot" sobre los puntos de un orden del dia, y
 *  `tocaba` como "era mi turno" sobre "quien tocaba la pared". */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  dejo:        { g: "I make it, I leave it (dejar)", t: "verb" },
  punto:       { g: "item, one thing on an agenda", t: "noun" },
  puntos:      { g: "items on an agenda (punto)", t: "noun" },
  vamos:       { g: "let us go (ir)" },
  "frío":      { g: "cold, of a drink gone cold", t: "adjective" },
  hecho:       { g: "ha hecho, has done (hacer)" },
  vista:       { g: "punto de vista, point of view" },
  cuanto:      { g: "cuanto antes, as soon as possible" },
  tocaba:      { g: "touched (tocar)" },
  termina:     { g: "finish it (terminar, command)" },
  trabaja:     { g: "works (trabajar)" },
  comenta:     { g: "remarks (comentar)" },
  recalentado: { g: "reheated (recalentar)", t: "adjective" },
  piensas:     { g: "you think (pensar)" },
  verdad:      { g: "de verdad, real, genuine" },
  siendo:      { g: "being (ser)" },
  acababa:     { g: "ended up (acabar)" },
  llegaba:     { g: "was arriving (llegar)" },
  llegado:     { g: "han llegado, have arrived (llegar)" },
  perdemos:    { g: "we lose the thread (perder)" },
  saberlo:     { g: "to know it (saber)" },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    if (f.slug === "") for (const [w, fix] of Object.entries(GLOBAL))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g)) if (g[w].rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`arreglos ${arreglos} · marcadas ${marcadas}`);
  await p.$disconnect();
})();
