/** Cuantas palabras del NUCLEO lleva cada cuerpo. Objetivo: 24. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const N = fs.readFileSync("scripts/_b1/nucleo.txt", "utf8").split(/\r?\n/).filter(Boolean);
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = S.map((s: any) => new Set(tok(s.text)));
let tot = 0;
for (const [i, s] of S.entries()) {
  const hay = N.filter((w) => cuerpos[i].has(w));
  tot += hay.length;
  const falta = 24 - hay.length;
  console.log(`${String(s.topic + "#" + s.slotIndex).padEnd(30)} ${String(hay.length).padStart(2)}${falta > 0 ? `  faltan ${falta}` : "  ok"}`);
}
const cuenta = N.map((w) => [w, cuerpos.filter((c: Set<string>) => c.has(w)).length] as [string, number]);
console.log(`\nmedia ${(tot / S.length).toFixed(1)} del nucleo por cuerpo`);
console.log(`nucleo: ${N.length} palabras, ${cuenta.reduce((a, b) => a + b[1], 0)} apariciones, media ${(cuenta.reduce((a,b)=>a+b[1],0)/N.length).toFixed(1)} cuerpos por palabra`);
console.log(`sin usar todavia: ${cuenta.filter(([, n]) => n === 0).map(([w]) => w).join(" ")}`);
