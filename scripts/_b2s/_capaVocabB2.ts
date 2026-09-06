/** Completa la capa de la glosa para las PLAZAS DE VOCAB del tema 1 del B2:
 *  claves multipalabra (la fila de la historia con la frase entera como clave,
 *  spec §4) y el infinitivo a la vista en los verbos sin tabla. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "las-llaves-de-la-pena": {
    "quedarse": { g: "to stay instead of leaving (quedarse)", t: "verb", c: { es: "cuánto se queda", en: "how long she is staying" } },
    "aburrirse": { g: "to get bored (aburrirse)", t: "verb", c: { es: "que si se aburre", en: "whether she gets bored" } },
    "caer en la cuenta": { g: "to suddenly realise", t: "expression", c: { es: "cae en la cuenta", en: "she realises" } },
    "calentarse la cara": { g: "to flush hot with embarrassment", t: "expression", c: { es: "se le calienta la cara", en: "her face goes hot" } },
    "de golpe": { g: "all at once", t: "expression", c: { es: "de golpe", en: "all at once" } },
    "sin prisa": { g: "without hurry", t: "expression", c: { es: "sin prisa", en: "without hurry" } },
  },
  "le-habian-guardado-tomates": {
    "mercado de abastos": { g: "covered food market", t: "noun", c: { es: "en el mercado de abastos", en: "at the covered food market" } },
    "lista de la compra": { g: "shopping list", t: "expression", c: { es: "la lista de la compra", en: "the shopping list" } },
    "salirse con la suya": { g: "to get away with it", t: "expression", c: { es: "haberse salido con la suya", en: "having got away with it" } },
    "dura poco": { g: "does not last long (durar)", t: "verb", c: { es: "le dura poco", en: "does not last long" } },
    "en voz baja": { g: "in a low voice, quietly", t: "expression", c: { es: "en voz baja", en: "under her breath" } },
    "de más": { g: "more than necessary", t: "expression", c: { es: "nadie la mira de más", en: "nobody gives her a second look" } },
    "tomado por": { g: "mistaken for (tomar por)", t: "expression", c: { es: "me ha tomado por turista", en: "has taken me for a tourist" } },
    "de los buenos": { g: "of the good kind", t: "expression", c: { es: "de los buenos", en: "of the good kind" } },
    "le toca": { g: "it is her turn (tocarle a alguien)", t: "expression", c: { es: "esta mañana le toca", en: "this morning it is her turn" } },
  },
  "la-sobremesa": {
    "se levanta": { g: "gets up (levantarse)", t: "verb", c: { es: "uno se levanta pronto", en: "one gets up early" } },
    "deja ir": { g: "lets go of it (dejar ir)", t: "expression", c: { es: "la deja ir", en: "lets it go" } },
    "de fuera": { g: "from somewhere else, not local", t: "expression", c: { es: "menos de fuera", en: "less of an outsider" } },
    "da igual": { g: "makes no difference (dar igual)", t: "expression", c: { es: "le da igual", en: "she does not mind" } },
    "sin palabras": { g: "without words", t: "expression", c: { es: "sin palabras", en: "without words" } },
    "por una vez": { g: "for once", t: "expression", c: { es: "pues por una vez", en: "well, for once" } },
  },
};

/** Verbos sin tabla: el infinitivo entre parentesis en la g de la fila de la historia. */
const INFINITIVOS: Record<string, Record<string, string>> = {
  "las-llaves-de-la-pena": {
    "encargado": "has commissioned her (encargar)",
    "apunta": "writes down (apuntar)",
  },
  "le-habian-guardado-tomates": {
    "colar": "to slip something false past someone (colar)",
    "guarden": "let them set aside for her (guardar)",
    "elijan": "let them choose for her (elegir)",
  },
  "la-sobremesa": {
    "sueltan": "they let go of you (soltar)",
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
  console.log("global:", Object.keys(g).length, "entradas");

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
