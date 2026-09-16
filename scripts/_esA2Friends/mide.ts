// Solo lectura: mide un JSON de tema antes de saveStory (palabras, citado, seguidilla,
// marcadores de gramatica, y el estado de cada plaza contra la lista y el pool spain).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { quotedStats } from "../_quotedRatio";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const dump = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const pcic = process.argv[4];
const norm = (w: string) => w.toLowerCase().trim().replace(/^(el|la|los|las|un|una)\s+/, "");
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const bloq = new Map<string, string>(); const ensen = new Set<string>();
for (const j of dump.js) { if (j.language !== "spanish" || j.variant !== "spain") continue;
  for (const s of j.stories) for (const v of (s.vocab ?? [])) { if (!v?.word) continue; const w = norm(v.word); ensen.add(w);
    if (j.typeSlug !== "relationships" && !PORT.has(String(v.type).toLowerCase())) bloq.set(w, j.levels.join()); } }
const RE: Array<[string, RegExp]> = [
  ["cond", /\b[a-zá-ú]+(ría|rían|ríamos)\b/giu], ["subjP", /\b(sea|sean|tenga|tengan|haya|hagan|pueda|puedan|venga|vengan|quiera|diga|vaya)\b/giu],
  ["subjI", /\b(?!para\b|cara\b|clara\b|rara\b|vara\b)[a-zá-ú]+(ara|aran|iera|ieran|ase|asen|iese|iesen)\b/giu],
  ["estInd", /\b(dijo|contó|explicó|preguntó|respondió|avisó)\s+(que|si)\b/giu], ["pluscu", /\bhabía\s+[a-zá-ú]+(ado|ido|to|cho)\b/giu],
  ["futuro", /\b[a-zá-ú]+(aré|arás|ará|aremos|erán|irá|iré|eré|erá|arán|irán)\b/giu],
];
const vistos = new Map<string, number>(); let cortas = 0, totalN = 0;
data.forEach((s: any, i: number) => {
  const t = s.text as string; const words = (t.match(/[\p{L}\p{N}']+/gu) ?? []).length;
  const q = quotedStats(t); const par = t.split(/\n{2,}/).length;
  let c = 0, n = 0; for (const o of t.replace(/“[^”]*”/g, "").split(/(?<=[.!?…])\s+|\n+/)) { const k = (o.match(/[\p{L}\p{N}']+/gu) ?? []).length; if (!k) continue; n++; if (k <= 4) c++; }
  cortas += c; totalN += n;
  const gram = RE.map(([k, r]) => `${k}:${(t.match(r) ?? []).join("|") || 0}`).join(" ");
  console.log(`\n### [${i}] ${s.title} (${s.title.length} car.) · ${words} pal · ${par} parr · citado ${q.pct.toFixed(1)}% · cortas ${c}/${n} · ${gram}`);
  const tl = t.toLowerCase(); let port = 0, ancl = 0, fuera: string[] = [];
  for (const v of s.vocab) {
    const w = norm(v.word); const typ = String(v.type); const exento = typ === "expression" || v.register === "cultural";
    PORT.has(typ) ? port++ : ancl++;
    const enLista = isSpanishUpToLevel(w, "a2");
    const flags = [!tl.includes(String(v.surface ?? v.word).toLowerCase()) ? "NO-EN-CUERPO" : "", exento ? "exenta" : enLista ? "lista" : "FUERA", bloq.has(w) && !PORT.has(typ) ? `BLOQ(${bloq.get(w)})` : "", ensen.has(w) ? "ya-ensenada" : "", vistos.has(w) ? `REPE[${vistos.get(w)}]` : ""].filter(Boolean);
    if (!exento && !enLista) fuera.push(w);
    vistos.set(w, i);
    console.log(`  ${typ.padEnd(10)} ${v.word.padEnd(24)} ${flags.join(" ")}`);
  }
  console.log(`  => ${s.vocab.length} plazas (${port} portables, ${ancl} ancladas) · fuera de lista: ${fuera.join(", ") || "-"}`);
  if (fuera.length && pcic) console.log(execFileSync("python3", ["scripts/_esA2Friends/pcic.py", pcic, ...fuera]).toString());
});
console.log(`\nSEGUIDILLA tema: ${cortas}/${totalN} = ${Math.round(100 * cortas / totalN)}%`);
