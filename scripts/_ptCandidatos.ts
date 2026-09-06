/** SOLO LECTURA. Dado un JSON de historias, lista por historia las palabras del
 *  cuerpo que AUN no ensena ningun journey de portugues, marcando si estan
 *  dentro del universo B1. Sirve para elegir vocab sin chocar con el solape. */
import * as fs from "fs";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
const ens = new Set<string>(JSON.parse(fs.readFileSync(process.env.E!, "utf8")));
const d = JSON.parse(fs.readFileSync(process.env.F!, "utf8"));
const FUERA = new Set("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que se e ou mas ja nao sim ao aos à às pelo pela e é são foi era ele ela eles elas eu voce você nos me te lhe seu sua meu minha dele dela isso isto aquilo aqui ali la lá quando onde como quem qual mais menos muito pouco tudo todo toda todos todas cada outro outra tambem so só ate até depois antes entao então porque".split(" "));
for (const s of d) {
  const parr = String(s.text).split("\n\n");
  console.log(`\n== ${s.slug}`);
  parr.forEach((t: string, i: number) => {
    const ws = (t.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ-]+/g) ?? []);
    const libres = [...new Set(ws)].filter((w) => !ens.has(w) && !FUERA.has(w) && w.length > 3);
    const dentro = libres.filter((w) => isPortugueseA1A2(w) || isPortugueseB1Lemma(w));
    const fuera = libres.filter((w) => !(isPortugueseA1A2(w) || isPortugueseB1Lemma(w)));
    console.log(`  ¶${i + 1} en nivel: ${dentro.join(" ") || "-"}`);
    console.log(`      fuera:    ${fuera.join(" ") || "-"}`);
  });
}
