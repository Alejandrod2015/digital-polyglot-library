// Solo lectura: cuantos lemas de italianA1A2 quedan para plaza en el Friends IT A1, por seccion.
// Usable = en lista, no ensenado como nombre por otro journey italiano, no usado ya como plaza
// en este journey (t1..tN-data.json), y fuera de las secciones gramaticales/numeros/fechas.
import { readFileSync } from "fs";
import { ITALIAN_A1_A2_LEMMAS } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const tipos = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) { const k = strip(v.word); if (!tipos.has(k)) tipos.set(k, new Set()); tipos.get(k)!.add(String(v.type)); }
const usados = new Set<string>();
for (const f of process.argv.slice(3)) for (const s of JSON.parse(readFileSync(f, "utf8"))) for (const v of s.vocab) usados.add(strip(v.word));
const src = readFileSync("src/lib/cefr/italianA1A2.ts", "utf8");
const secc = new Map<string, string>(); let cur = "?";
for (const line of src.split("\n")) { const c = line.match(/^\s*\/\/\s*(.+)$/); if (c) cur = c[1].slice(0, 30); for (const m of line.matchAll(/"([^"]+)"/g)) if (!secc.has(m[1])) secc.set(m[1], cur); }
const FUERA = /Function|Numbers|Time/;
const res: Record<string, string[]> = {};
let total = 0;
for (const w of ITALIAN_A1_A2_LEMMAS) {
  const s = secc.get(w) ?? "?"; if (FUERA.test(s)) continue;
  const t = tipos.get(w); if (t && [...t].some((x) => x === "noun")) continue;
  if (usados.has(w)) continue;
  (res[s] ??= []).push(w); total++;
}
for (const [s, ws] of Object.entries(res)) console.log(`${s.padEnd(30)} ${String(ws.length).padStart(3)}: ${ws.join(" ")}`);
console.log(`\nUSABLES que quedan: ${total} lemas`);
