/** Capa de la glosa para las plazas de vocab del TEMA 5 del B2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "un-barco-para-la-pena": {
    "cara a": { g: "facing towards (cara a)", t: "expression", c: { es: "cara al atardecer", en: "facing the sunset" } },
    "cara al": { g: "facing the (cara a)", t: "expression", c: { es: "cara al atardecer", en: "facing the sunset" } },
    "ir por": { g: "to be in someone's honour", t: "expression", c: { es: "esta ronda va por", en: "this round is for" } },
    "va por": { g: "goes to, is dedicated to (ir por)", t: "expression", c: { es: "esta ronda va por", en: "this round is for" } },
    "hacer una excepción": { g: "to make an exception", t: "expression", c: { es: "hoy hago una excepción", en: "today I make an exception" } },
    "hago una excepción": { g: "I make an exception (hacer una excepción)", t: "expression", c: { es: "hoy hago una excepción", en: "today I make an exception" } },
  },
  "el-levante-manda": {
    "hace caso": { g: "pays attention (hacer caso)", t: "expression", c: { es: "nadie le hace caso", en: "nobody pays it attention" } },
    "de andar por casa": { g: "homespun, everyday kind", t: "expression", c: { es: "refrán de andar por casa", en: "a homespun proverb" } },
    "echar de menos": { g: "to miss something", t: "expression", c: { es: "sin echar de menos el barco", en: "without missing the boat" } },
    "os debo una": { g: "I owe you one (deber una)", t: "expression", c: { es: "os debo una tarde entera", en: "I owe you a whole afternoon" } },
    "deber una": { g: "to owe someone one", t: "expression", c: { es: "os debo una tarde entera", en: "I owe you a whole afternoon" } },
  },
  "fecha-a-lapiz": {
    "a lápiz": { g: "in pencil, provisional", t: "expression", c: { es: "se escribe a lápiz", en: "is written in pencil" } },
    "de pronto": { g: "suddenly", t: "expression", c: { es: "de pronto entiende", en: "suddenly she understands" } },
    "a medias": { g: "halfway, only partly", t: "expression", c: { es: "escucha a medias", en: "half listens" } },
    "quedar por": { g: "to remain to be done", t: "expression", c: { es: "queda por elegir", en: "remains to be chosen" } },
    "queda por": { g: "remains to be (quedar por)", t: "expression", c: { es: "queda por elegir", en: "remains to be chosen" } },
    "el lápiz": { g: "the pencil (lápiz)", t: "noun", c: { es: "guarda el lápiz en el bolso", en: "puts the pencil away in her bag" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "un-barco-para-la-pena": {
    "amarra": "moors the boat (amarrar)",
    "arranca": "starts up (arrancar)",
    "confiesa": "confesses (confesar)",
    "agarrado": "holding on tight (agarrarse)",
    "apaga": "switches off (apagar)",
    "disfrutad": "enjoy, all of you (disfrutar, command)",
  },
  "el-levante-manda": {
    "aplaza": "postpones (aplazar)",
    "estropea": "ruins (estropear)",
    "silba": "whistles (silbar)",
    "sujeta": "holds down (sujetar)",
    "vuelan": "they fly off (volar)",
    "hermana": "brings together as family (hermanar)",
    "llora": "mourns, cries over (llorar)",
  },
  "fecha-a-lapiz": {
    "se negocian": "are negotiated (negociar)",
    "negocian": "are negotiated (negociar)",
    "amanece": "dawns (amanecer)",
    "cargamos": "we load (cargar)",
    "se repasa": "is gone over again (repasar)",
    "repasa": "goes over again (repasar)",
    "enciende": "switches on (encender)",
    "saluda": "greets (saludar)",
    "escucha": "listens (escuchar)",
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
