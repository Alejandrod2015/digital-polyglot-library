/** Lectura de las 75 copias del tema 4 contra su frase. Dieciseis traian el
 *  sentido de otro journey: `caja` era "a hand drum", `tubo` el snorkel,
 *  `banco` un taburete, `linea` la de pescar y `seguridad` un guardia. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  caja:       { g: "box; caja de herramientas, toolbox", t: "noun" },
  tubo:       { g: "pipe, of gas or water", t: "noun" },
  banco:      { g: "bank, where the money is", t: "noun" },
  falla:      { g: "lets us down, fails (fallar)", t: "verb" },
  marca:      { g: "dials (marcar)", t: "verb" },
  "línea":    { g: "line, of a telephone", t: "noun" },
  largo:      { g: "long", t: "adjective" },
  medio:      { g: "en medio, in the middle" },
  ido:        { g: "se ha ido, has gone (ir)" },
  "señal":    { g: "dar señal, to ring, of a phone", t: "noun" },
  costado:    { g: "ha costado, has cost (costar)", t: "verb" },
  volverse:   { g: "to turn round (volverse)" },
  seguridad:  { g: "confidence, being sure of yourself", t: "noun" },
  piloto:     { g: "pilot light, the small flame", t: "noun" },
  "señalando":{ g: "pointing at (señalar)" },
  abierto:    { g: "open", t: "adjective" },
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
