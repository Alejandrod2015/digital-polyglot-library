// Capa de contexto de las 21 historias de french-friends-france-a1 (molde: la
// capa del FR A0 Friends, scripts/_frA0/glosas/capa.ts). Sustituye la capa `c`
// que copiaba la palabra sola y cortaba la definicion.
//
// Entrada: trozos.json (trozos.ts, texto de la base) y piezas*.txt, donde cada
// historia lista sus piezas `frances ||| ingles`. Una pieza es un trozo entero
// o un constituyente suyo (literal, <= 8 palabras, ingles <= N+3). Cada palabra
// glosable toma la PRIMERA pieza donde sale; la clave es la de checkGlossContext
// (token entero en minuscula) o, en elisiones, la que resuelve el lector.
//   npx tsx scripts/_frA1F/glosas/capa.ts [--dry]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../../../src/generated/prisma";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "french-friends-france-a1", D = "scripts/_frA1F/glosas";
const LINT = /\p{L}[\p{L}\p{M}'-]*/gu;
const n = (s: string) => s.trim().split(/\s+/).length;
(async () => {
  const dry = process.argv.includes("--dry");
  const trozos: Record<string, string[]> = JSON.parse(fs.readFileSync(`${D}/trozos.json`, "utf8"));
  const piezas: Record<string, [string, string][]> = {};
  let slug = "";
  for (const f of fs.readdirSync(D).filter((x) => /^piezas\d+\.txt$/.test(x)).sort()) {
    for (const l of fs.readFileSync(`${D}/${f}`, "utf8").split("\n")) {
      if (!l.trim()) continue;
      if (l.startsWith("## ")) { slug = l.slice(3).trim(); piezas[slug] ??= []; continue; }
      const [fr, en] = l.split("|||").map((x) => x.trim());
      piezas[slug].push([fr, en]);
    }
  }
  const global = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, unknown>;
  const clave = (tok: string) => { const e = tok.toLowerCase().replace(/’/g, "'"); return global[e] ? e : glossKeyCandidates(tok).find((k) => global[k]); };
  const malas: string[] = [];
  for (const [s, ts] of Object.entries(trozos)) {
    const ps = piezas[s];
    if (!ps) { malas.push(`${s}: sin piezas`); continue; }
    for (const [fr, en] of ps) {
      if (!en) malas.push(`${s}: sin ingles: ${fr}`);
      if (!ts.some((t) => t.includes(fr))) malas.push(`${s}: pieza que no sale literal: ${fr}`);
      if (n(fr) > 8) malas.push(`${s}: pieza larga: ${fr}`);
      if (en && n(en) > n(fr) + 3) malas.push(`${s}: ingles largo: ${fr} / ${en}`);
    }
    // cada token glosable de cada trozo cae dentro de alguna pieza de ese trozo
    for (const t of ts) {
      const dentro = ps.filter(([fr]) => t.includes(fr)).map(([fr]) => fr);
      const cub = new Set(dentro.flatMap((fr) => (fr.match(TAPPABLE) ?? []).map((x) => x.toLowerCase())));
      const sin = (t.match(TAPPABLE) ?? []).filter((x) => clave(x) && !cub.has(x.toLowerCase()));
      if (sin.length) malas.push(`${s}: trozo sin cubrir [${sin.join(", ")}]: ${t}`);
    }
  }
  if (malas.length) { console.error(malas.join("\n")); console.error(`${malas.length} problemas`); process.exit(1); }
  fs.mkdirSync(`${D}/capas`, { recursive: true });
  let total = 0;
  for (const s of Object.keys(trozos)) {
    const capa: Record<string, { es: string; en: string }> = {};
    for (const [fr, en] of piezas[s]) {
      const ks = (fr.match(TAPPABLE) ?? []).map(clave);
      // checkGlossContext parte por su propia regex, que no lleva ’: `n’est` le
      // da `n` y `est`, y las dos claves necesitan su trozo.
      for (const m of fr.matchAll(LINT)) if (global[m[0].toLowerCase()]) ks.push(m[0].toLowerCase());
      for (const k of ks) if (k && !capa[k]) capa[k] = { es: fr, en };
    }
    total += Object.keys(capa).length;
    fs.writeFileSync(`${D}/capas/${s}.json`, JSON.stringify(capa, null, 1) + "\n");
    if (!dry) console.log(execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", B, s, `${D}/capas/${s}.json`], { encoding: "utf8" }).trim());
  }
  console.log(`${Object.keys(trozos).length} historias · ${total} entradas con trozo${dry ? " (dry, nada escrito)" : ""}`);
  await p.$disconnect();
})();
