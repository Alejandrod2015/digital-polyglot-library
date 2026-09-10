/** Capa de la glosa para las plazas de vocab de la historia 21. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";

type E = { g: string; t: string; c?: { es: string; en: string } };
const NUEVAS: Record<string, E> = {
  "de memoria": { g: "by heart, without needing notes", t: "expression", c: { es: "se la sabe de memoria", en: "knows it by heart" } },
  "pedir silencio": { g: "to ask for quiet", t: "expression", c: { es: "pide silencio", en: "asks for quiet" } },
  "pide silencio": { g: "asks for quiet (pedir silencio)", t: "expression", c: { es: "pide silencio", en: "asks for quiet" } },
  "el que se pique": { g: "whoever takes offence", t: "expression", c: { es: "el que se pique, que se aguante", en: "whoever takes offence has to lump it" } },
  "hacerte esperar": { g: "to make you wait", t: "expression", c: { es: "había que hacerte esperar", en: "we had to make you wait" } },
  "esta vez": { g: "this time, on this occasion", t: "expression", c: { es: "esta vez no apunta nada", en: "this time she writes nothing down" } },
  "ganarse": { g: "to earn, to deserve (ganarse)", t: "verb", c: { es: "me lo he ganado", en: "I have earned it" } },
  "he ganado": { g: "I have earned (ganarse)", t: "verb", c: { es: "me lo he ganado", en: "I have earned it" } },
  "subirse": { g: "to climb up onto (subirse)", t: "verb", c: { es: "subiéndose a una silla", en: "climbing onto a chair" } },
  "desdoblar": { g: "to unfold (desdoblar)", t: "verb", c: { es: "desdoblando un papel", en: "unfolding a paper" } },
  "retratar": { g: "to portray (retratar)", t: "verb", c: { es: "el primer verso ya la retrata", en: "the first line already portrays her" } },
  "aguantarse": { g: "to put up with it (aguantarse)", t: "verb", c: { es: "que se aguante", en: "has to put up with it" } },
  "se aguante": { g: "puts up with it (aguantarse)", t: "verb", c: { es: "que se aguante", en: "has to put up with it" } },
  "contar": { g: "to tell (contar)", t: "verb", c: { es: "ahora cuenta algo", en: "now it tells something" } },
  "estrenar": { g: "to open something new (estrenar)", t: "verb", c: { es: "estrena luz y olor a pintura", en: "shows off new light and paint" } },
  "clavo": { g: "nail (clavo)", t: "noun", c: { es: "con dos clavos", en: "with two nails" } },
};

const INFINITIVOS: Record<string, string> = {
  "estrena": "opens for the first time (estrenar)",
  "cuenta": "tells (contar)",
  "retrata": "portrays (retratar)",
  "reconocerse": "to recognise yourself (reconocerse)",
};

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!;
  const g = { ...(global.glosses as Record<string, unknown>) };
  for (const [k, v] of Object.entries(NUEVAS)) if (!g[k]) g[k] = { g: v.g, t: v.t };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "" } }, data: { glosses: g } });

  const fila = filas.find((f) => f.slug === "una-copla-con-su-nombre")!;
  const cap = { ...(fila.glosses as Record<string, any>) };
  for (const [k, v] of Object.entries(NUEVAS)) cap[k] = { ...(cap[k] ?? {}), ...v };
  for (const [k, gg] of Object.entries(INFINITIVOS)) if (cap[k]) cap[k] = { ...cap[k], g: gg };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: "una-copla-con-su-nombre" } }, data: { glosses: cap } });
  console.log("una-copla-con-su-nombre ->", Object.keys(cap).length, "entradas");
  await p.$disconnect();
})();
