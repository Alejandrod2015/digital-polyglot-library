/** Para cada palabra glosable de cada historia del B2, extrae el trozo
 *  constituyente (clausula entre comas/comillas/puntos que contiene la
 *  palabra, recortada a 5 si se pasa; tope duro 8) y deja `en` vacio para
 *  escribirlo a mano. Calcado del criterio de scripts/_b1/_proponeTrozos.ts. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b2";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const g = filas.find((f) => f.slug === "")!;
  const glob = g.glosses as Record<string, { g?: string }>;
  const exempt = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles[B];
  const ex = new Set<string>([...exempt.articles, ...exempt.numerals, ...exempt.characterNames].map((x: string) => x.toLowerCase()));
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g.slugs } }, select: { slug: true, title: true, text: true } });
  const out: Record<string, Record<string, { es: string; en: string }>> = {};
  let n = 0;
  for (const s of ss) {
    const texto = `${s.title}. ${s.text}`;
    const oraciones = texto.split(/(?<=[.?!…”])\s+/);
    const vistas = new Set<string>();
    for (const m of texto.matchAll(TAPPABLE)) {
      const k = m[0].toLowerCase();
      if (vistas.has(k) || ex.has(k) || !glob[k]) continue;
      vistas.add(k);
      const ora = oraciones.find((o) => N(o).split(" ").includes(N(k)) || N(o).includes(N(k))) ?? "";
      const clausulas = ora.split(/[,:;“”.!?¿¡]/).map((x) => N(x)).filter(Boolean);
      const cl = clausulas.find((x) => x.split(" ").includes(N(k))) ?? clausulas.find((x) => x.includes(N(k))) ?? "";
      let es = cl;
      const t = cl.split(" ");
      if (t.length > 5) {
        const j = t.findIndex((x) => x === N(k));
        const a = Math.max(0, Math.min(j - 2, t.length - 5));
        es = t.slice(a, a + 5).join(" ");
      }
      if (!es) es = N(k);
      (out[s.slug!] ??= {})[k] = { es, en: "" };
      n++;
    }
  }
  fs.writeFileSync("scripts/_b2s/trozos-tema1.json", JSON.stringify(out, null, 1));
  console.log(`propuestas: ${n} (scripts/_b2s/trozos-tema1.json)`);
  await p.$disconnect();
})();
