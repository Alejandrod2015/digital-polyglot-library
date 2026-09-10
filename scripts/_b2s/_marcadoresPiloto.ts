/** Frase a frase: condicional, subjuntivo imperfecto y estilo indirecto del piloto (regex propias, Unicode). */
import { readFileSync } from "fs";
const B = "(?<![\\p{L}])", E = "(?![\\p{L}])";
const M: Array<[string, RegExp]> = [
  ["COND", new RegExp(`${B}\\p{L}+(ría|rían|ríamos)${E}`, "giu")],
  ["SUBJ-I", new RegExp(`${B}(?!(?:para|cara|clara|rara|vara|frase|clase|base|fase|cualquiera|quiera|quieran)${E})\\p{L}+(ara|aran|iera|ieran|ase|asen|iese|iesen)${E}`, "giu")],
  ["EST-IND", new RegExp(`${B}(dijo|contó|explicó|preguntó|respondió|avisó|pidió|dicho|contado|preguntado|pedido)(?:\\s+\\p{L}+){0,3}\\s+(que|si|qué|dónde|cuándo|cómo|cuánto|quién)${E}`, "giu")],
];
const st = JSON.parse(readFileSync("scripts/_b2s/piloto/t1.json", "utf8"));
const tot: Record<string, number> = {};
for (const s of st) {
  console.log(`\n## ${s.title}`);
  for (const f of s.text.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/)) {
    const hits = M.flatMap(([n, r]) => (f.match(r) ?? []).map((x: string) => `${n}:${x}`));
    for (const h of hits) tot[h.split(":")[0]] = (tot[h.split(":")[0]] ?? 0) + 1;
    if (hits.length) console.log(`  [${hits.join(" · ")}] ${f}`);
  }
}
console.log(`\ntotales en 42 oraciones: ${JSON.stringify(tot)}`);
