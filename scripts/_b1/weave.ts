/**
 * Ayuda del tejido: por cada historia, que claves del journey lleva ya y
 * cuantas le faltan para el objetivo. La escalera pide ~53 claves por cuerpo.
 */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const claves = new Map<string, string>();
for (const s of S) for (const v of s.vocab) claves.set(String(v.surface ?? v.word).toLowerCase(), `${s.topic}#${s.slotIndex}`);
if (process.argv[3] === "--claves") {
  const porTema = new Map<string, string[]>();
  for (const [k, de] of claves) {
    const t = de.split("#")[0];
    porTema.set(t, [...(porTema.get(t) ?? []), k]);
  }
  for (const [t, ks] of porTema) console.log(`\n[${t}] ${ks.join(" ")}`);
  process.exit(0);
}
let tot = 0;
for (const s of S) {
  const c = new Set(tok(s.text));
  const dentro = [...claves.keys()].filter((k) => c.has(k));
  tot += dentro.length;
  const faltan = 53 - dentro.length;
  console.log(`${String(s.topic + "#" + s.slotIndex).padEnd(30)} ${String(dentro.length).padStart(3)} claves  ${faltan > 0 ? `faltan ${faltan}` : "ok"}`);
}
console.log(`\nmedia ${(tot / S.length).toFixed(1)} claves por cuerpo (objetivo 53) · escalera ${(tot / [...S].reduce((a: number, s: any) => a + s.vocab.length, 0)).toFixed(2)}`);
