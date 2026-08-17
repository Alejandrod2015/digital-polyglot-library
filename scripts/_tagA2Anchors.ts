/**
 * Cura las etiquetas `register` del vocab del Traveler ES/Spain A2, sobre el
 * JSON exportado. NO escribe en la base: el vocab solo entra por saveStory.ts.
 *
 * El generador ya había puesto register:"cultural" en 46 items, pero a mano
 * suelta: junto a realia de verdad (socarrat, queimada, conxuro, jata, majada,
 * telefonillo, cercanías) coló palabras corrientes. Como el cambio en
 * REGISTER_EXEMPT hace que esa etiqueta EXIMA del juicio de nivel, cada
 * etiqueta de más se convierte en una palabra difícil colada por la puerta de
 * atrás. Eso es justo lo que la exención no debe permitir.
 *
 * Criterio para quedarse con la etiqueta: el item nombra una cosa o una
 * práctica propia de España que ningún corpus de frecuencia va a situar en A2
 * porque solo aparece en ese contexto. Una palabra corriente que simplemente
 * sale en la historia NO es realia.
 */
import * as fs from "fs";

/** No son realia: palabras corrientes que el generador etiquetó de más. */
const STRIP = new Set(["detalle", "casualidad", "sitios"]);

/** Control: tras la cura, estas deben SEGUIR fallando el nivel en A2. */
const CONTROL = ["casualidad", "cualquiera", "promete"];

const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
  slug: string;
  vocab: Array<{ word: string; type?: string; register?: string }>;
}>;

let stripped = 0;
let kept = 0;
for (const s of stories) {
  for (const v of s.vocab ?? []) {
    const w = (v.word ?? "").trim().toLowerCase();
    if (!v.register) continue;
    if (STRIP.has(w)) {
      console.log(`  quitada etiqueta "${v.register}" de "${v.word}" (${s.slug})`);
      delete v.register;
      stripped++;
    } else {
      kept++;
    }
  }
}

for (const s of stories) {
  for (const v of s.vocab ?? []) {
    if (CONTROL.includes((v.word ?? "").toLowerCase()) && v.register) {
      throw new Error(`Control violado: "${v.word}" sigue etiquetado (${v.register})`);
    }
  }
}

console.log(`\netiquetas quitadas: ${stripped}  ·  etiquetas conservadas: ${kept}`);
console.log(`control limpio: ${CONTROL.join(", ")} sin register`);
fs.writeFileSync(process.argv[3], JSON.stringify(stories, null, 2));
console.log(`escrito ${process.argv[3]}`);
