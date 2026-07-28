/**
 * Convierte la narración del manuscrito al MISMO HTML que usa el catálogo, y
 * vuelve a aplicar el marcado de vocabulario.
 *
 * Convenciones observadas en el texto que ya está publicado:
 *   - prosa            -> <p>…</p>
 *   - acotación (…)    -> <p>…</p>  sin los paréntesis
 *   - diálogo "N: — x" -> <blockquote>N: x</blockquote>  (sin la raya)
 *   - las palabras de la lista de vocabulario DEL LIBRO (no las 44 glosas de
 *     la app) se envuelven en <span class="vocab-word" data-word="Palabra">,
 *     sólo en su PRIMERA aparición.
 *
 *   npx tsx scripts/_buildCatalogTextFromManuscript.ts <manuscrito.txt> <palabras,coma> <salida.html>
 */
import { readFileSync, writeFileSync } from "fs";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Envuelve la primera aparición de cada palabra, respetando acentos y
 * mayúsculas, y sin volver a envolver algo ya envuelto. */
function applyVocab(html: string, words: string[]): { html: string; applied: string[]; missed: string[] } {
  const applied: string[] = [];
  const missed: string[] = [];
  let out = html;
  for (const entry of words) {
    // "ciclos:Ciclo" = busca la forma que aparece en el texto, etiqueta con la
    // que usa la lista de vocabulario (el manuscrito puede tener el plural).
    const [surface, labelOverride] = entry.split(":");
    const word = surface;
    const re = new RegExp(`(?<![\\w>"])(${escapeRe(word)})(?![\\w<])`, "iu");
    const m = out.match(re);
    if (!m || m.index === undefined) {
      missed.push(word);
      continue;
    }
    const label = labelOverride || word.charAt(0).toUpperCase() + word.slice(1);
    out =
      out.slice(0, m.index) +
      `<span class="vocab-word" data-word="${label}">${m[1]}</span>` +
      out.slice(m.index + m[1].length);
    applied.push(word);
  }
  return { html: out, applied, missed };
}

function main() {
  const [src, wordsArg, dest] = process.argv.slice(2);
  const raw = readFileSync(src, "utf-8");
  const words = wordsArg.split(",").map((w) => w.trim()).filter(Boolean);

  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const html = blocks
    .map((b) => {
      if (/^\(.*\)$/.test(b)) return `<p>${b.slice(1, -1).trim()}</p>`;
      const dialogue = b.match(/^([^:]{1,24}):\s*—?\s*(.+)$/);
      if (dialogue) return `<blockquote>${dialogue[1]}: ${dialogue[2]}</blockquote>`;
      return `<p>${b}</p>`;
    })
    .join("\n\n");

  const { html: withVocab, applied, missed } = applyVocab(html, words);
  writeFileSync(dest, withVocab);

  const plain = withVocab.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`bloques: ${blocks.length} | <p>=${(withVocab.match(/<p>/g) || []).length} <blockquote>=${(withVocab.match(/<blockquote>/g) || []).length}`);
  console.log(`palabras del texto: ${plain.split(" ").length}`);
  console.log(`vocab marcado: ${applied.length}/${words.length}`);
  if (missed.length) console.log(`  NO encontradas en el texto: ${missed.join(", ")}`);
  console.log(`escrito: ${dest}`);
}

main();
