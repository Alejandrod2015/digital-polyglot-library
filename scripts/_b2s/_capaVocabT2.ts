/** Capa de la glosa para las plazas de vocab del TEMA 2 del B2: claves
 *  multipalabra y el infinitivo a la vista en los verbos sin tabla. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "la-copla-ya-lo-decia": {
    "picarse": { g: "to get stung by a joke (picarse)", t: "verb", c: { es: "claudia se pica", en: "Claudia gets stung" } },
    "cortar por el mismo patrón": { g: "cut from the same cloth", t: "expression", c: { es: "cortadas por el mismo patrón", en: "cut from the same cloth" } },
    "por encima del hombro": { g: "over your shoulder", t: "expression", c: { es: "por encima del hombro", en: "over her shoulder" } },
    "media sonrisa": { g: "half smile", t: "expression", c: { es: "con media sonrisa", en: "with half a smile" } },
  },
  "la-broma-se-queda-sola": {
    "lanzarse": { g: "to throw yourself in (lanzarse)", t: "verb", c: { es: "se lanza", en: "throws herself in" } },
    "dejarse querer": { g: "to enjoy the attention", t: "expression", c: { es: "se deja querer", en: "enjoys the attention" } },
    "al pie de la letra": { g: "to the letter, exactly as stated", t: "expression", c: { es: "al pie de la letra", en: "to the letter" } },
    "por medio": { g: "in between, in the middle", t: "expression", c: { es: "por medio", en: "in between" } },
    "de recuerdo": { g: "as a keepsake", t: "expression", c: { es: "de recuerdo", en: "as a keepsake" } },
  },
  "de-eso-se-rie-marcos": {
    "sin rodeos": { g: "straight out, plainly", t: "expression", c: { es: "sin rodeos", en: "without going around it" } },
    "trato hecho": { g: "deal done", t: "expression", c: { es: "trato hecho", en: "deal done" } },
    "de momento": { g: "for now", t: "expression", c: { es: "de momento", en: "for now" } },
    "con ganas": { g: "wholeheartedly", t: "expression", c: { es: "se ríe con ganas", en: "laughs wholeheartedly" } },
    "ponerse a": { g: "to get started on (ponerse a)", t: "expression", c: { es: "se pone a desmontar", en: "gets started dismantling" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "la-copla-ya-lo-decia": {
    "disimula": "hides what she feels (disimular)",
    "vacila": "teases playfully (vacilar)",
    "propone": "proposes (proponer)",
    "manda": "is in charge (mandar)",
    "barría": "used to sweep (barrer)",
  },
  "la-broma-se-queda-sola": {
    "afila": "sharpens the teasing (afilar)",
    "dispara": "fires off (disparar)",
    "apila": "stacks up (apilar)",
    "rescata": "rescues the moment (rescatar)",
    "aprieta": "squeezes (apretar)",
    "echen": "they throw out (echar)",
    "atreverse": "to dare (atreverse)",
  },
  "de-eso-se-rie-marcos": {
    "devuelta": "returned, given back (devolver)",
    "cuelgo": "I hang it up (colgar)",
    "concede": "grants the point (conceder)",
    "desmontar": "to take apart (desmontar)",
    "desaparezca": "it disappears (desaparecer)",
    "vale": "is worth, counts as (valer)",
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
