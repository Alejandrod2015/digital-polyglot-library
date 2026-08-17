import { splitSentences } from "../src/lib/exampleSentence";
const cases: [string, number][] = [
  ["Ça va bien aujourd'hui. Água é vida.", 2],   // fr Ç + pt Á(guilla) inicio 2ª
  ["Il arrive demain. Être ou ne pas être.", 2], // Ê
  ["Ótimo trabalho. Íris já chegou.", 2],         // pt Ó, Í
  ["C'est fini. Ãngulo reto.", 2],                // Ã
  ["Itzel se reía con las puntadas de Rodrigo.", 1], // una sola (no sobre-split)
  ["Kein Wort. Ölige Hände überall.", 2],         // de Ö (regresión)
  ["Está bien. Ñandú corre.", 2],                 // es Ñ (regresión)
  ['„Nein!", sagte er leise.', 1],                // diálogo: minúscula sigue → 1
];
let ok = 0;
for (const [t, exp] of cases) {
  const n = splitSentences(t).length;
  const pass = n === exp;
  if (pass) ok++;
  console.log(`${pass ? "PASS" : "FAIL"}  esperado=${exp} obtenido=${n}  "${t}"`);
}
console.log(`\n${ok}/${cases.length} OK`);
