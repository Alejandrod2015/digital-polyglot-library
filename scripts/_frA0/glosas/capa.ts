// Capa de contexto de las 21 historias de french-friends-a0. Para cada historia:
// sus trozos (trozos.json) con su traduccion (traducciones.json); cada palabra
// glosable toma el PRIMER trozo donde sale. La clave es la que mira
// checkGlossContext (token entero en minuscula) y, en las elisiones, la que
// resuelve el lector (l'eau -> eau). Escribe con writeGlossLayer.
//   npx tsx scripts/_frA0/glosas/capa.ts [--dry]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../../../src/generated/prisma";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "french-friends-a0", D = "scripts/_frA0/glosas";
(async () => {
  const dry = process.argv.includes("--dry");
  const trozos: Record<string, string[]> = JSON.parse(fs.readFileSync(`${D}/trozos.json`, "utf8"));
  const tr: Record<string, Record<string, string>> = JSON.parse(fs.readFileSync(`${D}/traducciones.json`, "utf8"));
  const global = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, unknown>;
  const faltan: string[] = [], sobran: string[] = [];
  for (const [slug, ts] of Object.entries(trozos)) {
    for (const t of ts) if (!tr[slug]?.[t]) faltan.push(`${slug}: ${t}`);
    for (const t of Object.keys(tr[slug] ?? {})) if (!ts.includes(t)) sobran.push(`${slug}: ${t}`);
  }
  if (faltan.length || sobran.length) { console.error("sin traduccion:", faltan, "\ntraduccion sin trozo:", sobran); process.exit(1); }
  // Trozos de mas de 8 palabras: se parten en constituyentes (partes.json), que
  // tienen que salir tal cual del trozo, no pasar de 8 palabras, y cuyo ingles
  // no pasa de N+3 (las tres reglas de lint:gloss-variants).
  const partes: Record<string, [string, string][]> = JSON.parse(fs.readFileSync(`${D}/partes.json`, "utf8"));
  const n = (s: string) => s.trim().split(/\s+/).length;
  const malas: string[] = [];
  const piezas = (slug: string, t: string): [string, string][] => {
    if (n(t) <= 8) return [[t, tr[slug][t]]];
    const ps = partes[t];
    if (!ps) { malas.push(`sin partir: ${t}`); return []; }
    for (const [fr, en] of ps) if (!t.includes(fr) || n(fr) > 8 || n(en) > n(fr) + 3) malas.push(`parte mala: ${fr} / ${en}`);
    return ps;
  };
  for (const [slug, ts] of Object.entries(trozos)) for (const t of ts) {
    piezas(slug, t);
    if (n(tr[slug][t]) > n(t) + 3 && n(t) <= 8) malas.push(`ingles largo: ${t} / ${tr[slug][t]}`);
  }
  if (malas.length) { console.error(malas.join("\n")); process.exit(1); }
  fs.mkdirSync(`${D}/capas`, { recursive: true });
  let total = 0;
  for (const [slug, ts] of Object.entries(trozos)) {
    const capa: Record<string, { es: string; en: string }> = {};
    for (const t of ts) for (const [fr, en] of piezas(slug, t)) for (const tok of fr.match(TAPPABLE) ?? []) {
      const entero = tok.toLowerCase().replace(/’/g, "'");
      const clave = global[entero] ? entero : glossKeyCandidates(tok).find((k) => global[k]);
      if (clave && !capa[clave]) capa[clave] = { es: fr, en };
    }
    total += Object.keys(capa).length;
    fs.writeFileSync(`${D}/capas/${slug}.json`, JSON.stringify(capa, null, 1) + "\n");
    if (!dry) console.log(execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", B, slug, `${D}/capas/${slug}.json`], { encoding: "utf8" }).trim());
  }
  console.log(`${Object.keys(trozos).length} historias · ${total} entradas con trozo${dry ? " (dry, nada escrito)" : ""}`);
  await p.$disconnect();
})();
