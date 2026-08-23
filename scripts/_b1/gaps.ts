/** Por cada historia: claves del journey que NO estan en su cuerpo, y palabras
 *  de contenido del cuerpo que no son clave de nadie (candidatas a sustituir). */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const claves = new Set<string>();
for (const s of S) for (const v of s.vocab) claves.add(String(v.surface ?? v.word).toLowerCase());
const solo = process.argv[3];
for (const s of S) {
  const id = `${s.topic}#${s.slotIndex}`;
  if (solo && !id.startsWith(solo)) continue;
  const cuerpo = new Set(tok(s.text));
  const dentro = [...claves].filter((k) => cuerpo.has(k));
  console.log(`\n=== ${id}  ${dentro.length} claves presentes de ${claves.size}`);
  console.log(`  presentes: ${dentro.join(" ")}`);
}
