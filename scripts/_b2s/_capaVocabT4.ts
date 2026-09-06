/** Capa de la glosa para las plazas de vocab del TEMA 4 del B2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, Record<string, E>> = {
  "el-ano-que-falta": {
    "a primera hora": { g: "first thing in the morning", t: "expression", c: { es: "a primera hora", en: "first thing in the morning" } },
    "con la palabra en la boca": { g: "cut off mid-sentence", t: "expression", c: { es: "con la palabra en la boca", en: "cut off mid-sentence" } },
    "a media tarde": { g: "in the middle of the afternoon", t: "expression", c: { es: "a media tarde", en: "mid-afternoon" } },
    "por eso mismo": { g: "for that very reason", t: "expression", c: { es: "por eso mismo", en: "for that very reason" } },
    "al fin": { g: "at last", t: "expression", c: { es: "suelta al fin", en: "lets out at last" } },
    "sonar a": { g: "to sound like (sonar)", t: "expression", c: { es: "suena a puerta cerrada", en: "sounds like a closed door" } },
    "suena a": { g: "sounds like (sonar a)", t: "expression", c: { es: "suena a puerta cerrada", en: "sounds like a closed door" } },
  },
  "decide-tu": {
    "sin adornos": { g: "plainly, without dressing it up", t: "expression", c: { es: "sin adornos", en: "without dressing it up" } },
    "por primera vez": { g: "for the first time", t: "expression", c: { es: "por primera vez", en: "for the first time" } },
    "el otro lado": { g: "the other side", t: "expression", c: { es: "ahora ve el otro lado", en: "now she sees the other side" } },
  },
  "una-copla-sin-cantar": {
    "a mano": { g: "by hand, handwritten", t: "expression", c: { es: "una copla a mano", en: "a handwritten song" } },
    "al pie": { g: "at the bottom", t: "expression", c: { es: "al pie hay una fecha", en: "at the bottom there is a date" } },
    "de lado": { g: "sideways, at an angle", t: "expression", c: { es: "la luz entra de lado", en: "the light comes in sideways" } },
    "dejar de": { g: "to stop doing something", t: "expression", c: { es: "dejaron de hablarse", en: "stopped speaking to each other" } },
    "dejaron de": { g: "they stopped (dejar de)", t: "expression", c: { es: "dejaron de hablarse", en: "stopped speaking to each other" } },
    "con el corazón en un puño": { g: "tense with worry", t: "expression", c: { es: "con el corazón en un puño", en: "with her heart in her fist" } },
    "se la lleva": { g: "takes it along (llevarse)", t: "verb", c: { es: "se la lleva a hugo", en: "takes it along to Hugo" } },
    "llevarse": { g: "to take along (llevarse)", t: "verb", c: { es: "se la lleva a hugo", en: "takes it along to Hugo" } },
  },
};

const INFINITIVOS: Record<string, Record<string, string>> = {
  "el-ano-que-falta": {
    "subrayada": "underlined (subrayar)",
    "agotara": "it sold out (agotarse)",
    "tarda": "takes time (tardar)",
    "duele": "hurts (doler)",
    "falta": "is missing (faltar)",
  },
  "decide-tu": {
    "calló": "went quiet (callar)",
    "marca": "marks (marcar)",
    "asiente": "nods (asentir)",
    "repita": "happens again (repetirse)",
    "aparta": "turns away (apartar)",
    "gritan": "they shout (gritar)",
    "cuidar": "to look after (cuidar)",
  },
  "una-copla-sin-cantar": {
    "pesara": "it weighed (pesar)",
    "se nota": "it shows (notarse)",
    "nombrar": "to name (nombrar)",
    "dibuja": "draws (dibujar)",
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
