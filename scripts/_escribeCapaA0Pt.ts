// Escribe la capa de contexto del Traveler PT-BR A0 nuevo, historia a historia, con writeGlossLayer.ts.
//   npx tsx scripts/_escribeCapaA0Pt.ts <dirHojas> <traducciones.json> [--dry]
// traducciones.json: { "<trozo es>": "<en>", ... , "_fix": { "<slug>|<palabra>": { "g": "...", "t"?: "..." } } }
// Cada entrada toma el trozo que le asigno _propTrozosA0Pt.ts; si una traduccion falta, no escribe esa historia.
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
const [dir, fichero] = process.argv.slice(2);
const dry = process.argv.includes("--dry");
const tr = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, any>;
const fix = (tr._fix ?? {}) as Record<string, { g: string; t?: string }>;
let escritas = 0, faltan = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json") && !x.startsWith(".")).sort()) {
  const hoja = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const out: Record<string, { es: string; en: string; g?: string; t?: string }> = {};
  const sinTr: string[] = [];
  for (const [es, v] of Object.entries(hoja.trozos as Record<string, { palabras: Record<string, string> }>)) {
    const en = tr[es];
    if (!en) { sinTr.push(es); continue; }
    for (const w of Object.keys(v.palabras)) {
      const fx = fix[`${hoja.slug}|${w}`];
      out[w] = { es, en, ...(fx ? { g: fx.g, ...(fx.t ? { t: fx.t } : {}) } : {}) };
    }
  }
  for (const [k, fx] of Object.entries(fix)) {
    const [slug, w] = k.split("|");
    if (slug === hoja.slug && tr[`${slug}|${w}|es`]) out[w] = { es: tr[`${slug}|${w}|es`], en: tr[`${slug}|${w}|en`], g: fx.g, ...(fx.t ? { t: fx.t } : {}) };
  }
  if (sinTr.length) { faltan += sinTr.length; console.log(`${hoja.slug}: ${sinTr.length} trozos sin traduccion -> ${sinTr.slice(0, 5).join(" / ")}`); continue; }
  const tmp = path.join(dir, `.${hoja.slug}.capa.json`);
  fs.writeFileSync(tmp, JSON.stringify(out, null, 1));
  if (dry) { console.log(`${hoja.slug}: ${Object.keys(out).length} entradas listas (dry)`); continue; }
  execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", "portuguese-traveler-brazil-a0", hoja.slug, tmp], { stdio: "inherit" });
  escritas++;
}
console.log(`historias escritas: ${escritas} · trozos sin traduccion: ${faltan}`);
