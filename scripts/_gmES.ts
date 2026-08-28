/** Propone m./f. para los sustantivos de un bundle español.
 *  Primero por el ARTÍCULO que va pegado en el texto real, que es la única
 *  prueba que no adivina; y solo si no hay artículo, por la terminación.
 *  npx tsx scripts/_gmES.ts <bundle> <textos.json> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
// Solo lo que MARCA genero. `su`, `mi` y `cada` no lo marcan, y metiendolos
// salia "su alma" = m. y "cada cosa" = m.
const M = new Set(["el","un","los","unos","del","al","este","ese","aquel","estos","esos","otro","otros"]);
const F = new Set(["la","una","las","unas","esta","esa","aquella","estas","esas","otra","otras"]);
const PLURAL = new Set(["los","unos","las","unas","estos","esos","estas","esas","otros","otras"]);
/** Femeninas que llevan `el` por empezar por a tonica: el alma, el arpa. */
const F_CON_EL = new Set(["alma","arpa","hambre","agua","aula","area","área","ave","hacha","ala","aguila","águila"]);
(async () => {
  const [bundle, fichero] = process.argv.slice(2);
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const g = filas.find((f) => f.slug === "")!.glosses as Record<string, { t?: string }>;
  const nouns = new Set<string>();
  for (const f of filas.filter((f) => f.slug !== "")) {
    for (const [w, v] of Object.entries(f.glosses as Record<string, { t?: string }>)) {
      if ((v.t ?? g[w]?.t) === "noun") nouns.add(w);
    }
  }
  const votos = new Map<string, { m: number; f: number; pl: number; sg: number }>();
  for (const texto of Object.values(JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>)) {
    const ws = (texto.match(/\p{L}+/gu) ?? []).map((x) => x.toLowerCase());
    ws.forEach((w, i) => {
      if (!nouns.has(w)) return;
      const a = ws[i - 1] ?? "";
      if (!M.has(a) && !F.has(a)) return;
      const v = votos.get(w) ?? { m: 0, f: 0, pl: 0, sg: 0 };
      if (F_CON_EL.has(w)) v.f++;
      else if (M.has(a)) v.m++; else v.f++;
      if (PLURAL.has(a)) v.pl++; else v.sg++;
      votos.set(w, v);
    });
  }
  const conArt: string[] = [], porRegla: string[] = [], choque: string[] = [], sinNada: string[] = [];
  const out: Record<string, string> = {};
  for (const w of [...nouns].sort()) {
    const v = votos.get(w);
    if (v && v.m && v.f) { choque.push(`${w} (m:${v.m} f:${v.f})`); continue; }
    if (v) {
      const gen = v.m ? "m." : "f.";
      const marca = v.pl > v.sg ? `${gen} (pl.)` : gen;
      out[w] = marca; conArt.push(`${w}=${marca}`); continue;
    }
    // Sin artículo pegado: la terminación, y solo cuando es de las seguras.
    let gen: string | null = null;
    if (/(ción|sión|dad|tad|tud|umbre|ez|eza|ura|anza|encia|ancia)$/.test(w)) gen = "f.";
    else if (/(aje|or|ar|és|ismo)$/.test(w)) gen = "m.";
    else if (/a$/.test(w)) gen = "f.";
    else if (/o$/.test(w)) gen = "m.";
    if (gen) { out[w] = gen; porRegla.push(`${w}=${gen}`); } else sinNada.push(w);
  }
  fs.writeFileSync("/tmp/gmes.json", JSON.stringify(out, null, 0));
  console.log(`POR ARTICULO (${conArt.length}):\n${conArt.join(" ")}\n`);
  console.log(`POR REGLA, revisar (${porRegla.length}):\n${porRegla.join(" ")}\n`);
  console.log(`CHOQUE de artículo (${choque.length}): ${choque.join(" ")}\n`);
  console.log(`SIN NADA (${sinNada.length}): ${sinNada.join(" ")}`);
  await p.$disconnect();
})();
