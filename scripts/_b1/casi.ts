/** Claves que el cuerpo casi contiene: esta el singular y la clave es plural, o
 *  al reves. Cada una es un encuentro perdido por una letra. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const claves = [...new Set(S.flatMap((s: any) => s.vocab.map((v: any) => String(v.surface ?? v.word).toLowerCase())))] as string[];
const out: string[] = [];
for (const s of S) {
  const c = new Set(tok(s.text));
  for (const k of claves) {
    if (c.has(k)) continue;
    for (const cand of [k + "s", k + "es", k.replace(/es$/, ""), k.replace(/s$/, "")]) {
      if (cand !== k && c.has(cand)) { out.push(`${s.topic}#${s.slotIndex}  ${cand} -> ${k}`); break; }
    }
  }
}
console.log(`${out.length} encuentros perdidos por una letra:\n` + out.join("\n"));
