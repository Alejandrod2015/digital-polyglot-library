/** Reescribe UNA linea de cada historia dada para que Rafaela hable con
 *  acotacion, que es lo que mide `journey-cast-protagonist-in-all`. El texto
 *  sale por saveStory como siempre; esto solo prepara el JSON. */
import * as fs from "fs";
const cambios: Record<string, [string, string]> = JSON.parse(fs.readFileSync(process.env.C!, "utf8"));
const f = process.env.F!;
const d = JSON.parse(fs.readFileSync(f, "utf8"));
let n = 0;
for (const s of d) {
  const c = cambios[s.slug];
  if (!c) continue;
  if (!String(s.text).includes(c[0])) { console.log(`  NO CASA en ${s.slug}: ${c[0]}`); continue; }
  s.text = String(s.text).replace(c[0], c[1]);
  n++;
}
fs.writeFileSync(f, JSON.stringify(d, null, 1));
console.log(`${n} historia(s) con acotacion nueva -> ${f}`);
