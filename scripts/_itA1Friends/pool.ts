// Solo lectura: cuanta plaza DENTRO de italianA1A2 queda para el Friends IT A1.
// libre = no ensenada en ningun journey italiano vigente; reabrible = ensenada solo como portable (verb/adj/adv/expression).
import { readFileSync } from "fs";
import { ITALIAN_A1_A2_LEMMAS } from "../../src/lib/cefr/italianA1A2";
const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
const strip = (w: string) => w.toLowerCase().trim().replace(/^(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l'|un')/, "");
const tipos = new Map<string, Set<string>>();
for (const j of d.js.filter((j: any) => j.language === "italian"))
  for (const s of j.stories) for (const v of s.vocab ?? []) {
    const k = strip(String(v.word)); if (!tipos.has(k)) tipos.set(k, new Set()); tipos.get(k)!.add(String(v.type));
  }
const src = readFileSync("src/lib/cefr/italianA1A2.ts", "utf8");
// secciones por comentario
const secc = new Map<string, string>(); let cur = "?";
for (const line of src.split("\n")) {
  const c = line.match(/^\s*\/\/\s*(.+)$/); if (c) cur = c[1].slice(0, 40);
  for (const m of line.matchAll(/"([^"]+)"/g)) if (!secc.has(m[1])) secc.set(m[1], cur);
}
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const out: Record<string, { libre: string[]; reabrible: string[]; bloqueada: number }> = {};
for (const w of ITALIAN_A1_A2_LEMMAS) {
  const s = secc.get(w) ?? "?"; out[s] ??= { libre: [], reabrible: [], bloqueada: 0 };
  const t = tipos.get(w);
  if (!t) out[s].libre.push(w); else if ([...t].every((x) => PORT.has(x))) out[s].reabrible.push(w); else out[s].bloqueada++;
}
let L = 0, R = 0, B = 0;
for (const [s, o] of Object.entries(out)) {
  L += o.libre.length; R += o.reabrible.length; B += o.bloqueada;
  console.log(`${s.padEnd(40)} libre ${String(o.libre.length).padStart(3)} reabrible ${String(o.reabrible.length).padStart(3)} bloqueada ${o.bloqueada}`);
  if (process.argv[3]) console.log("   L:", o.libre.join(" "), "\n   R:", o.reabrible.join(" "));
}
console.log(`TOTAL ${ITALIAN_A1_A2_LEMMAS.size} lemas: libre ${L}, reabrible ${R}, bloqueada ${B}`);
