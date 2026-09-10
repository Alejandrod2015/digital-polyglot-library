/** Capa de la glosa para las plazas de vocab del TEMA 7 (las dos guardadas). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "quien-baja-del-tren": {
    "de sobra": { g: "more than enough", t: "expression", c: { es: "con tiempo de sobra", en: "with time to spare" } },
    "de toda la vida": { g: "lifelong, always done that way", t: "expression", c: { es: "como los de toda la vida", en: "like the lifelong locals" } },
    "sin abrir la boca": { g: "without saying a word", t: "expression", c: { es: "pide dos cafés sin abrir la boca", en: "orders two coffees without a word" } },
    "de verdad": { g: "truly, for real", t: "expression", c: { es: "da las gracias de verdad", en: "thanks her truly" } },
    "dar las gracias": { g: "to say thank you", t: "expression", c: { es: "le da las gracias de verdad", en: "thanks her truly" } },
    "da las gracias": { g: "thanks (dar las gracias)", t: "expression", c: { es: "le da las gracias de verdad", en: "thanks her truly" } },
    "por si": { g: "just in case", t: "expression", c: { es: "por si lo echabas de menos", en: "in case you missed it" } },
    "abrazarse": { g: "to hug each other (abrazarse)", t: "verb", c: { es: "se abrazan dos veces", en: "they hug twice" } },
    "se abrazan": { g: "they hug (abrazarse)", t: "verb", c: { es: "se abrazan dos veces", en: "they hug twice" } },
    "funcionar": { g: "to work (funcionar)", t: "verb", c: { es: "todavía te funciona", en: "still works for you" } },
    "desconocido": { g: "unknown, a stranger (desconocido)", t: "adjective", c: { es: "la agenda de una desconocida", en: "a stranger's planner" } },
  },
  "la-ultima-llave": {
    "tal y como": { g: "exactly as", t: "expression", c: { es: "tal y como estaba negociado", en: "exactly as negotiated" } },
    "de visita": { g: "on a visit, as a guest", t: "expression", c: { es: "paula, de visita", en: "Paula, here on a visit" } },
    "quedarse atrás": { g: "to be left behind", t: "expression", c: { es: "nadie se queda atrás", en: "nobody is left behind" } },
    "se queda atrás": { g: "is left behind (quedarse atrás)", t: "expression", c: { es: "nadie se queda atrás", en: "nobody is left behind" } },
    "hacer falta": { g: "to be necessary", t: "expression", c: { es: "no hace falta", en: "there is no need" } },
    "hace falta": { g: "is needed (hacer falta)", t: "expression", c: { es: "no hace falta", en: "there is no need" } },
    "en los brazos": { g: "in your arms", t: "expression", c: { es: "una caja en los brazos", en: "a box in her arms" } },
    "temer": { g: "to fear (temer)", t: "verb", c: { es: "claudia teme", en: "Claudia fears" } },
    "oírse": { g: "to be heard (oírse)", t: "verb", c: { es: "el clic se oye entero", en: "the click is heard whole" } },
    "se oye": { g: "is heard (oírse)", t: "verb", c: { es: "el clic se oye entero", en: "the click is heard whole" } },
    "informar": { g: "to inform (informar)", t: "verb", c: { es: "le informa marcos", en: "Marcos informs her" } },
    "recordar": { g: "to remind (recordar)", t: "verb", c: { es: "recuerda marcos", en: "Marcos reminds her" } },
    "curar": { g: "to heal (curar)", t: "verb", c: { es: "la herida ya curada", en: "the wound now healed" } },
    "mudarse": { g: "to move house (mudarse)", t: "verb", c: { es: "se muda una casa entera", en: "a whole home moves" } },
    "se muda": { g: "moves house (mudarse)", t: "verb", c: { es: "se muda una casa entera", en: "a whole home moves" } },
    "sudado": { g: "sweaty (sudado)", t: "adjective", c: { es: "sudada y contenta", en: "sweaty and happy" } },
    "contento": { g: "happy, pleased (contento)", t: "adjective", c: { es: "sudada y contenta", en: "sweaty and happy" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "quien-baja-del-tren": {
    "hojea": "leafs through (hojear)",
    "traigo": "I bring (traer)",
    "funciona": "works (funcionar)",
    "tocará": "will fall to her (tocar)",
  },
  "la-ultima-llave": {
    "teme": "fears (temer)",
    "informa": "informs (informar)",
    "recuerda": "reminds (recordar)",
    "curada": "healed (curar)",
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
