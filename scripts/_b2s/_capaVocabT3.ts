/** Capa de la glosa para las plazas de vocab del TEMA 3 del B2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "lo-de-siempre-cadiz-b2": {
    "lo de siempre": { g: "the usual order", t: "expression", c: { es: "lo de siempre", en: "the usual" } },
    "dar por sabido": { g: "to take as known", t: "expression", c: { es: "da su café por sabido", en: "takes her coffee as known" } },
    "ya era hora": { g: "about time", t: "expression", c: { es: "ya era hora de llegar", en: "about time I arrived" } },
    "lo suyo": { g: "each person's usual thing", t: "expression", c: { es: "lo suyo llega solo", en: "their usual arrives by itself" } },
    "mejor que nunca": { g: "better than ever", t: "expression", c: { es: "sabe mejor que nunca", en: "tastes better than ever" } },
  },
  "aqui-se-apunta": {
    "a fin de mes": { g: "at the end of the month", t: "expression", c: { es: "se paga a fin de mes", en: "is paid at the end of the month" } },
    "al día": { g: "on the spot, up to date", t: "expression", c: { es: "paga al día", en: "pays on the spot" } },
    "en paz": { g: "even, settled up", t: "expression", c: { es: "cóbrame y en paz", en: "charge me and we are even" } },
    "a la vista de todos": { g: "in full view of everyone", t: "expression", c: { es: "a la vista de todos", en: "in full view of everyone" } },
    "deber dinero": { g: "to owe money (deber)", t: "verb", c: { es: "deber dinero le pica", en: "owing money stings her" } },
  },
  "una-ronda-sin-dueno": {
    "de buen humor": { g: "in a good mood", t: "expression", c: { es: "de buen humor", en: "in a good mood" } },
    "de reojo": { g: "out of the corner of the eye", t: "expression", c: { es: "sonrisas de reojo", en: "sideways smiles" } },
    "darse por aludido": { g: "to take the hint", t: "expression", c: { es: "nadie se da por aludido", en: "nobody takes the hint" } },
    "sin bajar la voz": { g: "without lowering your voice", t: "expression", c: { es: "sin bajar la voz", en: "without lowering her voice" } },
    "de la casa": { g: "on the house", t: "expression", c: { es: "cosa de la casa", en: "the house's own business" } },
    "cosa de": { g: "a matter of, business of", t: "expression", c: { es: "cosa de la casa", en: "the house's business" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "lo-de-siempre-cadiz-b2": {
    "empuje": "she pushes (empujar)",
    "fías": "you trust (fiarse)",
    "ocupa": "takes the seat (ocupar)",
    "discuten": "they argue (discutir)",
    "firma": "signs (firmar)",
  },
  "aqui-se-apunta": {
    "señala": "points at (señalar)",
    "ata": "ties, binds (atar)",
    "promete": "promises (prometer)",
    "secando": "drying (secar)",
    "sonríe": "smiles (sonreír)",
  },
  "una-ronda-sin-dueno": {
    "chocando": "clinking glasses (chocar)",
    "alza": "raises (alzar)",
    "avisa": "lets everyone know (avisar)",
    "guiña": "winks (guiñar)",
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
