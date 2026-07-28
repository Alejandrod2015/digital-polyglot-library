/**
 * Convierte las narraciones del manuscrito al HTML del catálogo, para todo un
 * libro, y vuelve a aplicar el marcado de vocabulario.
 *
 * Convenciones copiadas del texto ya publicado:
 *   prosa y acotaciones -> <p>…</p>  (las acotaciones pierden los paréntesis)
 *   diálogo "N: — x"    -> <blockquote>N: x</blockquote>  (sin la raya)
 *   vocabulario del libro -> <span class="vocab-word" data-word="Palabra">,
 *   sólo en la primera aparición.
 *
 *   npx tsx scripts/_buildBookTexts.ts <manuscritoDir> <salidaDir>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import path from "path";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** El manuscrito puede traer la palabra en plural o con otra terminación que
 * la lista de vocabulario; se prueban variantes antes de darla por ausente. */
function inflect(w: string): string[] {
  const out = [w];
  if (/s$/i.test(w)) out.push(w.replace(/es$/i, ""), w.replace(/s$/i, ""));
  else out.push(`${w}s`, `${w}es`);
  if (/z$/i.test(w)) out.push(w.replace(/z$/i, "ces")); // disfraz -> disfraces
  if (/ces$/i.test(w)) out.push(w.replace(/ces$/i, "z"));
  if (/a$/i.test(w)) out.push(w.replace(/a$/i, "o"));
  if (/o$/i.test(w)) out.push(w.replace(/o$/i, "a"));
  return out;
}

function variants(word: string): string[] {
  const out = inflect(word);
  // En frases ("arepa de huevo", "calle empedrada") la que se flexiona suele
  // ser la primera palabra, o la última si es un adjetivo.
  const parts = word.split(/\s+/);
  if (parts.length > 1) {
    for (const f of inflect(parts[0])) out.push([f, ...parts.slice(1)].join(" "));
    for (const l of inflect(parts[parts.length - 1])) out.push([...parts.slice(0, -1), l].join(" "));
  }
  return [...new Set(out)].filter((w) => w.length > 2);
}

function applyVocab(html: string, words: string[]) {
  const applied: string[] = [];
  const missed: string[] = [];
  let out = html;
  for (const word of words) {
    let done = false;
    for (const v of variants(word)) {
      const re = new RegExp(`(?<![\\w>"])(${escapeRe(v)})(?![\\w<])`, "iu");
      const m = out.match(re);
      if (!m || m.index === undefined) continue;
      const label = word.charAt(0).toUpperCase() + word.slice(1);
      out =
        out.slice(0, m.index) +
        `<span class="vocab-word" data-word="${label}">${m[1]}</span>` +
        out.slice(m.index + m[1].length);
      applied.push(word);
      done = true;
      break;
    }
    if (!done) missed.push(word);
  }
  return { html: out, applied, missed };
}

function toHtml(raw: string): string {
  return raw
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((b) => {
      if (/^\(.*\)$/.test(b)) return `<p>${b.slice(1, -1).trim()}</p>`;
      const d = b.match(/^([^:]{1,24}):\s*—?\s*(.+)$/);
      if (d) return `<blockquote>${d[1]}: ${d[2]}</blockquote>`;
      return `<p>${b}</p>`;
    })
    .join("\n\n");
}

function main() {
  const [src, dest] = process.argv.slice(2);
  mkdirSync(dest, { recursive: true });
  const slugs = readdirSync(src).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4)).sort();

  let totalMissed = 0;
  for (const slug of slugs) {
    const raw = readFileSync(path.join(src, `${slug}.txt`), "utf-8");
    const words: string[] = JSON.parse(readFileSync(path.join(src, `${slug}.words.json`), "utf-8"));
    const { html, applied, missed } = applyVocab(toHtml(raw), words);
    writeFileSync(path.join(dest, `${slug}.html`), html);
    totalMissed += missed.length;
    const plain = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    console.log(
      `  ${slug.padEnd(36)} ${String(plain).padStart(4)} palabras  vocab ${applied.length}/${words.length}` +
        (missed.length ? `  sin marcar: ${missed.join(", ")}` : "")
    );
  }
  console.log(`\nhistorias: ${slugs.length} | palabras de vocab sin marcar en total: ${totalMissed}`);
}

main();
