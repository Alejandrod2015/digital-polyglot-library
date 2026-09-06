/** Lectura de las 125 copias del tema 2 contra su frase. Veinticinco traian el
 *  sentido del journey de origen: `causa` decia "buddy, dude" (Peru), `factura`
 *  "pastry, as it is called in Argentina", `blanco` "the target of teasing" y
 *  `capaz` el "maybe" del Rio de la Plata sobre un "capaz de" de Espana. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const GLOBAL: Record<string, { g?: string; t?: string }> = {
  da:        { g: "falls on, of light (dar)" },
  ve:        { g: "sees (ver)" },
  este:      { g: "this" },                       // arrastraba un "um" de relleno
  fijo:      { g: "steady, of a job" },
  capaz:     { g: "able to", t: "adjective" },    // decia "maybe"
  cargo:     { g: "charge, the part the office keeps", t: "noun" },
  causa:     { g: "cause, reason", t: "noun" },   // decia "buddy, dude"
  lista:     { g: "list", t: "noun" },
  pago:      { g: "payment", t: "noun" },
  media:     { g: "media mañana, mid morning" },
  "mañana":  { g: "morning", t: "noun" },
  tarde:     { g: "late", t: "adverb" },
  blanco:    { g: "en blanco, blank, with nothing written" },
  precio:    { g: "price", t: "noun" },
  factura:   { g: "invoice, the bill for work done", t: "noun" },
  medias:    { g: "a medias, half done" },
  agenda:    { g: "schedules (agendar)", t: "verb" },
  compra:    { g: "the shopping", t: "noun" },
  pasar:     { g: "to come in (pasar)" },
  sigue:     { g: "carries on (seguir)" },
  negocia:   { g: "negotiates (negociar)" },
  cobrar:    { g: "to get paid (cobrar)" },
  "confía":  { g: "trusts (confiar)" },
  guardado:  { g: "stored, put away", t: "adjective" },
  "venía":   { g: "came (venir)" },
};
/** `tarde` es adverbio en dos historias y sustantivo en la tercera. */
const PORHISTORIA: Record<string, Record<string, { g?: string; t?: string }>> = {
  "cobrar-es-otro-trabajo": { tarde: { g: "afternoon", t: "noun" } },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    if (f.slug === "") for (const [w, fix] of Object.entries(GLOBAL))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const [w, fix] of Object.entries(PORHISTORIA[f.slug] ?? {}))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g)) if (g[w].rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`arreglos ${arreglos} · marcadas ${marcadas}`);
  await p.$disconnect();
})();
