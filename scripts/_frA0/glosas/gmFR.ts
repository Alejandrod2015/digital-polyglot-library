// SOLO LECTURA. Propone m./f. para los sustantivos de french-friends-a0 a partir
// del ARTICULO pegado en el texto real (la unica prueba que no adivina).
// Marcan genero: le un du au ce cet(m) / la une cette(f). No lo marcan: l' les
// des aux ces mon ton son (son écharpe), ma ta sa si. Lo que no tiene
// articulo marcado se decide a mano (sale en la lista "a mano").
//   npx tsx scripts/_frA0/glosas/gmFR.ts > scripts/_frA0/glosas/gm-propuesta.json
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
const M = new Set(["le", "un", "du", "au", "ce", "cet", "quel", "nouveau", "vieux", "vieil"]);
const F = new Set(["la", "une", "cette", "quelle", "nouvelle", "vieille"]);
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "french-friends-a0" } });
  const g = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  const nouns = new Set<string>();
  for (const f of filas.filter((f) => f.slug)) for (const [w, v] of Object.entries(f.glosses as Record<string, any>)) if ((v.t ?? g[w]?.t) === "noun") nouns.add(w);
  const trozos: Record<string, string[]> = JSON.parse(fs.readFileSync("scripts/_frA0/glosas/trozos.json", "utf8"));
  const votos = new Map<string, { m: number; f: number }>();
  for (const ts of Object.values(trozos)) for (const t of ts) {
    const ws = (t.toLowerCase().replace(/’/g, "'").match(/[\p{L}'-]+/gu) ?? []);
    ws.forEach((w, i) => {
      if (!nouns.has(w) || i === 0) return;
      // salta un adjetivo intercalado ("un grand sac", "une petite camionnette")
      for (const prev of [ws[i - 1], ws[i - 2]]) {
        if (!prev) continue;
        const v = votos.get(w) ?? { m: 0, f: 0 };
        if (M.has(prev)) { v.m++; votos.set(w, v); break; }
        if (F.has(prev)) { v.f++; votos.set(w, v); break; }
      }
    });
  }
  const prop: Record<string, string> = {}, dudas: string[] = [], aMano: string[] = [];
  for (const w of [...nouns].sort()) {
    const v = votos.get(w);
    if (!v) { aMano.push(w); continue; }
    if (v.m && v.f) { dudas.push(`${w} (m ${v.m} / f ${v.f})`); continue; }
    prop[w] = v.m ? "m." : "f.";
  }
  const expat = await p.tapGlossSet.findFirst({ where: { bundle: "french-expat-lyon", NOT: { slug: "" } } });
  const gmEj = Object.entries(expat!.glosses as Record<string, any>).filter(([, v]) => v.gm).slice(0, 5).map(([k, v]) => `${k}:${v.gm}`);
  console.error(`sustantivos ${nouns.size} · por articulo ${Object.keys(prop).length} · dudas ${dudas.length} · a mano ${aMano.length}`);
  console.error("formato gm en el Expat:", gmEj.join(" ") || "(el Expat no tiene gm)");
  console.error("dudas:", dudas.join(", "));
  console.error("a mano:", aMano.join(" "));
  console.log(JSON.stringify(prop, null, 1));
  await p.$disconnect();
})();
