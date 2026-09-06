/** Lectura de las 192 copias contra su frase. Diez salieron mal; el resto pasa.
 *  Al final se marca `rev: true`, que es lo que el lint pide. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
/** Arreglos globales: la glosa o el tipo estaban mal en cualquier historia. */
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  tapa:    { t: "verb" },                                   // "covers" tipado como sustantivo
  oye:     { t: "verb" },                                   // tipado como expresion
  muda:    { t: "verb" },                                   // tipado como adjetivo
  colgado: { t: "verb", g: "ha colgado, has hung (colgar)" },
  pegado:  { t: "verb", g: "ha pegado, has stuck (pegar)" },  // decia "dancing close together"
  cinta:   { g: "tape" },                                   // decia "narrow strip of cloth, for tying or decorating"
  vive:    { g: "lives (vivir)" },                          // infinitivo sobre una forma conjugada
  hace:    { g: "hace falta, you need (hacer)" },
};
/** Arreglos de UNA historia: la palabra significa otra cosa alli. */
const PORHISTORIA: Record<string, Record<string, { g?: string }>> = {
  "arriba-vive-alguien": {
    primera: { g: "the first one" },   // "a la primera" es de la otra historia
    abre:    { g: "opens (abrir)" },   // el ejemplo de Berta es de la otra historia
  },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const [w, fix] of Object.entries(GLOBAL))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const [w, fix] of Object.entries(PORHISTORIA[f.slug] ?? {}))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g)) if (g[w].rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`arreglos ${arreglos} · marcadas como leidas ${marcadas}`);
  await p.$disconnect();
})();
