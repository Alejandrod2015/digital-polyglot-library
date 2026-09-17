/** Vuelca, para cada palabra sin contexto del B1, la oracion donde cae.
 *  Solo lectura; sirve para escribir los trozos que faltan a mano. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "portuguese-traveler-brazil-b1";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, unknown>;
  const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
  const historias = await p.journeyStory.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true },
  });
  for (const h of historias) {
    const propia = (filas.find((f) => f.slug === h.slug)?.glosses ?? {}) as Record<string, { c?: unknown }>;
    const texto = `${h.title}. ${h.text}`;
    const faltan = [...new Set([...texto.matchAll(TOCABLE)].map((m) => m[0].toLowerCase()))]
      .filter((w) => global[w] && !propia[w]?.c);
    if (!faltan.length) continue;
    console.log(`\n── ${h.slug}`);
    for (const w of faltan) {
      const re = new RegExp(`(?<!\\p{L})${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu");
      const frase = texto.split(/(?<=[.!?…][”"]?)\s+|\n+/).find((f) => re.test(f)) ?? "(no la encuentro)";
      console.log(`  ${w}\n    ${frase.trim()}`);
    }
  }
  await p.$disconnect();
})();
