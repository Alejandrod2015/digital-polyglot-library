/**
 * Caza el defecto que el gate de audio destapo en `el-velon-de-delia`: un
 * fill_blank cuya respuesta NO concuerda en forma con sus distractores.
 * Cuando solo una opcion tiene otra forma, el hueco se resuelve sin saber la
 * palabra, y ademas la frase con la respuesta puesta puede no ser espanol.
 *
 * Clasifica cada opcion por forma (infinitivo, participio m./f., plural,
 * adverbio en -mente, sustantivo/otro) y avisa cuando la respuesta cae en una
 * clase donde esta SOLA.
 */
import { readdirSync, readFileSync } from "fs";
const DIR = "scripts/_sets";

function forma(w: string): string {
  const x = w.toLowerCase().trim();
  if (/\s/.test(x)) return "locucion";
  if (/(arse|erse|irse)$/.test(x)) return "infinitivo";
  if (/(ar|er|ir)$/.test(x) && x.length > 3) return "infinitivo";
  if (/(ado|ido)$/.test(x)) return "participio-m";
  if (/(ada|ida)$/.test(x)) return "participio-f";
  if (/mente$/.test(x)) return "adverbio";
  if (/(os|as|es)$/.test(x)) return "plural";
  return "otro";
}

const slugs = process.argv.slice(2);
let avisos = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  const slug = f.replace(".json", "");
  if (slugs.length && !slugs.includes(slug)) continue;
  const exs = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
  for (const e of exs) {
    if (e.type !== "fill_blank") continue;
    const opts: string[] = e.payload?.options ?? [];
    if (opts.length < 2) continue;
    const clases = opts.map(forma);
    const suya = clases[0];
    const iguales = clases.filter((c) => c === suya).length;
    if (iguales === 1) {
      avisos++;
      console.log(`${slug} · '${e.word}': la respuesta es ${suya} y los distractores son ${[...new Set(clases.slice(1))].join(", ")}`);
      console.log(`    ${e.sentence}   [${opts.join(" | ")}]`);
    }
  }
}
console.log(avisos ? `\nAVISOS: ${avisos}` : "\nsin avisos: en todos los fill_blank la respuesta comparte forma con algun distractor");
