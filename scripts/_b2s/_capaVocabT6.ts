/** Capa de la glosa para las plazas de vocab del TEMA 6 del B2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "de-trabajo-o-de-vivir": {
    "bajo el brazo": { g: "under your arm", t: "expression", c: { es: "bajo el brazo", en: "under her arm" } },
    "por fin": { g: "at last", t: "expression", c: { es: "bajando por fin", en: "finally coming down" } },
    "de segunda mano": { g: "second-hand", t: "expression", c: { es: "la librería de segunda mano", en: "the second-hand bookshop" } },
    "por ahí": { g: "around somewhere", t: "expression", c: { es: "le queda algo por ahí", en: "any left around somewhere" } },
    "moverse": { g: "to move (moverse)", t: "verb", c: { es: "la caja no se mueve", en: "the box is not moving" } },
    "se mueve": { g: "moves (moverse)", t: "verb", c: { es: "la caja no se mueve de aquí", en: "the box is not moving from here" } },
    "se vendió": { g: "was sold (vender)", t: "verb", c: { es: "una biblioteca que se vendió", en: "a library that was sold" } },
  },
  "este-no-todavia": {
    "con cara de": { g: "with the look of", t: "expression", c: { es: "con cara de examen", en: "with an examiner's look" } },
    "volver a": { g: "to do again (volver a)", t: "expression", c: { es: "lo vuelve a cerrar", en: "closes it once more" } },
    "vuelve a cerrar": { g: "closes it again (volver a)", t: "expression", c: { es: "lo vuelve a cerrar", en: "closes it once more" } },
    "a la antigua": { g: "the old-fashioned way", t: "expression", c: { es: "se cierra a la antigua", en: "closes the old way" } },
    "uno a uno": { g: "one by one", t: "expression", c: { es: "los conté uno a uno", en: "I counted them one by one" } },
    "dando vueltas": { g: "going round in your head", t: "expression", c: { es: "se queda dando vueltas", en: "keeps going round her head" } },
    "agacharse": { g: "to bend down (agacharse)", t: "verb", c: { es: "se agacha y saca un tomo", en: "bends down and takes out a volume" } },
    "se agacha": { g: "bends down (agacharse)", t: "verb", c: { es: "se agacha y saca un tomo", en: "bends down and takes out a volume" } },
    "envolver": { g: "to wrap (envolver)", t: "verb", c: { es: "envueltos en papel de periódico", en: "wrapped in newspaper" } },
    "forrar": { g: "to cover a book (forrar)", t: "verb", c: { es: "forrado a mano", en: "covered by hand" } },
    "manuscrito": { g: "handwritten (manuscrito)", t: "adjective", c: { es: "manuscrita y torcida", en: "handwritten and crooked" } },
    "cruzado": { g: "crossed, folded (cruzado)", t: "adjective", c: { es: "con los brazos cruzados", en: "with her arms folded" } },
    "tanda": { g: "batch (tanda)", t: "noun", c: { es: "salen por tandas", en: "leave in batches" } },
  },
  "los-libros-vuelven-a-casa": {
    "en voz alta": { g: "aloud, out loud", t: "expression", c: { es: "a leer en voz alta", en: "to read aloud" } },
    "con las dos manos": { g: "with both hands, carefully", t: "expression", c: { es: "lo abre con las dos manos", en: "opens it with both hands" } },
    "por el mundo": { g: "out into the world", t: "expression", c: { es: "por el mundo", en: "out into the world" } },
    "sin pedir permiso": { g: "without asking permission", t: "expression", c: { es: "sin pedir permiso", en: "without asking permission" } },
    "tender la mano": { g: "to hold out your hand", t: "expression", c: { es: "le tiende la mano", en: "holds out his hand to her" } },
    "tiende la mano": { g: "holds out a hand (tender la mano)", t: "expression", c: { es: "le tiende la mano", en: "holds out his hand to her" } },
    "cruzar": { g: "to cross (cruzar)", t: "verb", c: { es: "cruzan la ciudad", en: "cross the city" } },
    "perderse": { g: "to get lost (perderse)", t: "verb", c: { es: "para que no se perdiera", en: "so it would not be lost" } },
    "se perdiera": { g: "it got lost (perderse)", t: "verb", c: { es: "para que no se perdiera", en: "so it would not be lost" } },
    "invitar": { g: "to invite (invitar)", t: "verb", c: { es: "la invita a quedarse", en: "invites her to stay" } },
    "añadir": { g: "to add (añadir)", t: "verb", c: { es: "añade, con la voz normal", en: "she adds, in a plain voice" } },
    "negar": { g: "to refuse (negar)", t: "verb", c: { es: "nadie se lo habría negado", en: "nobody would have refused her" } },
    "medir": { g: "to measure (medir)", t: "verb", c: { es: "las baldas ya medidas", en: "the shelves already measured" } },
    "callado": { g: "quiet, kept silent (callado)", t: "adjective", c: { es: "la custodia callada", en: "the quiet guardianship" } },
    "último": { g: "last (último)", t: "adjective", c: { es: "llega la última", en: "arrives last" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "de-trabajo-o-de-vivir": {
    "pasea": "strolls (pasear)",
    "reconoce": "recognises (reconocer)",
    "respiraran": "they breathed (respirar)",
  },
  "este-no-todavia": {
    "enseña": "shows (enseñar)",
    "saca": "takes out (sacar)",
  },
  "los-libros-vuelven-a-casa": {
    "cruzan": "they cross (cruzar)",
    "invita": "invites (invitar)",
    "añade": "adds (añadir)",
    "negado": "refused (negar)",
    "medidas": "measured (medir)",
  },
};

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!;
  const g = { ...(global.glosses as Record<string, unknown>) };
  for (const ws of Object.values(NUEVAS))
    for (const [k, v] of Object.entries(ws))
      if (!g[k]) g[k] = { g: v.g, t: v.t };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: g } });

  for (const [slug, ws] of Object.entries(NUEVAS)) {
    const fila = filas.find((f) => f.slug === slug)!;
    const cap = { ...(fila.glosses as Record<string, any>) };
    for (const [k, v] of Object.entries(ws)) cap[k] = { ...(cap[k] ?? {}), ...v };
    for (const [k, gg] of Object.entries(INFINITIVOS[slug] ?? {}))
      if (cap[k]) cap[k] = { ...cap[k], g: gg };
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: cap } });
    console.log(slug, "->", Object.keys(cap).length, "entradas");
  }
  await p.$disconnect();
})();
