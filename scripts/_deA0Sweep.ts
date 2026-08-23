/**
 * Barrido a mano del suelo A0 aleman, que ningun gate comprueba
 * ([[feedback_a0_floor_has_no_gate]]): frases de NARRADOR que no empiezan por
 * el sujeto, particulas separables al final, `es gibt` y tiempos que no son
 * presente. Los incisos de habla (`sagt Elias`) y las lineas citadas quedan
 * fuera: ahi la inversion es obligatoria y correcta.
 *
 *   npx tsx scripts/_deA0Sweep.ts <data.json>
 */
import * as fs from "fs";

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as { slug: string; text: string }[];

// Campo inicial que NO es sujeto: preposiciones y adverbios que fuerzan V2.
const NO_SUJETO = new RegExp(
  "^(In|Im|An|Am|Auf|Aus|Bei|Beim|Mit|Nach|Seit|Von|Vom|Vor|Zu|Zum|Zur|Über|Unter|Zwischen|Durch|Für|Gegen|Ohne|Um|Neben|Hinter|" +
  "Dann|Danach|Heute|Gestern|Später|Manchmal|Plötzlich|Oben|Unten|Draußen|Drinnen|Hier|Dort|Jetzt|Deshalb|Trotzdem|Endlich|" +
  "Sofort|Zuerst|Abends|Morgens|Nachts|Jedes|Jeden|Einmal|Zweimal|Diesmal|Damals|Dafür|Dabei|Dazu|Wieder|Nur|Auch|Noch|Immer)\\b"
);
const PARTICULAS = ["an","auf","aus","ein","mit","nach","vor","zu","ab","bei","hin","her","zurück","los","weiter","vorbei","herum","raus","rein","weg","fest","nieder","um"];
const PART_FINAL = new RegExp(`\\s(${PARTICULAS.join("|")})\\s*[.!?]$`, "i");
const PERIFRASIS = /\b(bleibt|bleiben)\s+(stehen|sitzen|liegen)\b|\b(liest|geht|macht)\s+weiter\b/i;
const PASADO = /\b(war|waren|hatte|hatten|ging|kam|sagte|machte|stand|sah|nahm|gab|fuhr|wurde|wurden)\b/;
const PERFEKT = /\b(habe|hast|hat|haben|habt|bin|bist|ist|sind|seid)\s+\w+[^.!?]*\s(ge\w+|\w+t|\w+en)\s*[.!?,”]/;

let n = 0;
for (const r of rows) {
  // Fuera lo citado: dentro de comillas la inversion y el imperativo son normales.
  const narr = r.text.replace(/“[^”]*”/g, " ");
  for (const raw of narr.split(/(?<=[.!?])\s+/)) {
    const f = raw.trim();
    if (!f || f.length < 4) continue;
    const flags: string[] = [];
    if (NO_SUJETO.test(f)) flags.push("no empieza por el sujeto");
    if (PART_FINAL.test(f)) flags.push("particula separable al final");
    if (PERIFRASIS.test(f)) flags.push("bleibt stehen / geht weiter");
    if (/\bes gibt\b/i.test(f)) flags.push("es gibt");
    if (PASADO.test(f)) flags.push("no es presente");
    if (flags.length) { n++; console.log(`${r.slug}\n   [${flags.join(" · ")}] ${f}`); }
  }
}
console.log(`\n${n} frases de narrador marcadas`);
