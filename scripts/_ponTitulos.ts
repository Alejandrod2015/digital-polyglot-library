/** Pone los titulos nuevos en el volcado del tema y comprueba lo que saveStory
 *  no comprueba: que CADA palabra del titulo salga en el cuerpo de SU historia.
 *
 *  Por que importa: el titulo es superficie tocable, asi que una palabra que
 *  solo vive en el titulo abre un hueco de gloss-context y hay que glosarla
 *  aparte. Sacando cada palabra del cuerpo, el retitulado no deja deuda.
 *
 *  Uso: _ponTitulos.ts <topic> "<titulo slot0>" "<titulo slot1>" "<titulo slot2>"
 *  Escribe el fichero listo para `saveStory --title-only`. */
import * as fs from "fs";

const TOPE = 26;
const [topic, ...titulos] = process.argv.slice(2);
const fichero = `scripts/_ptTitulos/${topic}.json`;
const hs = JSON.parse(fs.readFileSync(fichero, "utf8")) as Array<{
  slug: string; slotIndex: number; title: string; text: string;
}>;

const palabras = (s: string) => (s.toLowerCase().normalize("NFC").match(/\p{L}+/gu) ?? []);
let malos = 0;

for (const [i, h] of hs.entries()) {
  const nuevo = titulos[i];
  if (!nuevo) { console.log(`slot ${h.slotIndex}: sin titulo nuevo, se queda "${h.title}"`); continue; }
  const cuerpo = new Set(palabras(h.text));
  const fuera = palabras(nuevo).filter((w) => !cuerpo.has(w));
  const largo = nuevo.length > TOPE;
  if (fuera.length || largo) {
    malos++;
    console.log(`MAL  ${h.slug}: "${nuevo}" (${nuevo.length})`);
    if (largo) console.log(`       pasa del tope de ${TOPE}`);
    if (fuera.length) console.log(`       no salen en el cuerpo: ${fuera.join(", ")}`);
  } else {
    console.log(`ok   ${h.slug}: "${h.title}" -> "${nuevo}" (${nuevo.length})`);
  }
  h.title = nuevo;
}

if (malos) { console.log(`\n${malos} sin arreglar; el fichero NO se toca`); process.exit(1); }
fs.writeFileSync(fichero, `${JSON.stringify(hs, null, 2)}\n`);
console.log(`\n${fichero} listo para saveStory --title-only`);
