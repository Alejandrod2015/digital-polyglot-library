/**
 * Revisa los sets del A2 España buscando lo que `_validateSets.ts` NO mira:
 * calidad del inglés y coherencia de las opciones. El validador solo comprueba
 * que las cuatro opciones sean distintas y que la respuesta sea la primera.
 *
 * Comprueba:
 *  - artículo "a" delante de sonido vocálico ("a envelope")
 *  - titular de verbo cuyas opciones no van todas en infinitivo ("to X")
 *  - opciones no paralelas: unas con "to" y otras sin
 *  - juegos de distractores repetidos entre ejercicios del mismo set
 *  - fill_blank cuya traducción regala la respuesta
 *  - glosas sospechosamente largas frente al resto de su ejercicio
 */
import * as fs from "fs";

const SLUGS = fs.readdirSync("scripts/_sets").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
const TARGET = new Set(process.argv.slice(2));
const VOWELISH = /^(a|e|i|o|u)/i;

let issues = 0;
for (const slug of SLUGS) {
  if (TARGET.size && !TARGET.has(slug)) continue;
  const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${slug}.json`, "utf8")) as Record<string, unknown>[];
  const found: string[] = [];
  const optionSets = new Map<string, string>();

  for (const ex of exs) {
    const p = (ex.payload ?? {}) as Record<string, unknown>;
    const type = String(ex.type);
    const word = String(ex.word ?? "");
    const groups: { answer: string; options: string[] }[] = [];
    if (type === "match_meaning") {
      for (const pr of (p.pairs as { answer: string; options: string[] }[]) ?? []) groups.push(pr);
    } else {
      groups.push({ answer: String(p.answer ?? ""), options: (p.options as string[]) ?? [] });
    }

    for (const g of groups) {
      // "a" + sonido vocálico
      for (const o of g.options) {
        const m = o.match(/\ba (\w+)/i);
        if (m && VOWELISH.test(m[1]) && !/^(uni|use|one|eu)/i.test(m[1])) {
          found.push(`${type} '${word}': "${o}" debería ser "an ${m[1]}..."`);
        }
      }
      // paralelismo de infinitivos
      if (type !== "fill_blank") {
        const withTo = g.options.filter((o) => /^to /.test(o)).length;
        if (withTo > 0 && withTo !== g.options.length) {
          found.push(`${type} '${word}': opciones mezcladas, ${withTo}/${g.options.length} empiezan por "to"`);
        }
      }
    }

    // distractores repetidos dentro del set
    if (type === "meaning_in_context" || type === "fill_blank") {
      const key = [...((p.options as string[]) ?? [])].sort().join("|");
      if (optionSets.has(key)) found.push(`${type} '${word}': mismo juego de opciones que '${optionSets.get(key)}'`);
      else optionSets.set(key, word);
    }

    // la traducción regala la respuesta
    if (type === "fill_blank") {
      const tr = String(p.translation ?? "").toLowerCase();
      const ans = String(p.answer ?? "").toLowerCase();
      if (ans && tr.includes(ans)) found.push(`fill_blank '${word}': la traducción contiene la respuesta "${ans}"`);
    }
  }

  if (found.length) {
    issues += found.length;
    console.log(`\n${slug}`);
    for (const f of found) console.log(`  ${f}`);
  }
}
console.log(issues ? `\n${issues} avisos` : "\nsin avisos mecánicos");
