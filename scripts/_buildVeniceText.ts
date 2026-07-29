/**
 * Convierte la narración del manuscrito al HTML del libro de Venecia.
 *
 * Se separa de `_buildCatalogTextFromManuscript.ts` por dos convenciones que
 * este libro NO comparte con el colombiano:
 *  - Los diálogos van SEGUIDOS dentro del mismo bloque (una línea por
 *    interlocutor, sin línea en blanco entre ellas), así que hay que partir
 *    también por saltos simples o los tres quedarían en un solo blockquote.
 *  - Las acotaciones "(leggendo il diario)" se quedan DENTRO del blockquote y
 *    CON paréntesis, como en el texto ya publicado; en el colombiano se
 *    sacaban a un <p> sin paréntesis.
 *
 *   npx tsx scripts/_buildVeniceText.ts <manuscrito.txt> <salida.html> <palabra,palabra,...>
 */
import { readFileSync, writeFileSync } from "fs";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Envuelve CADA aparición de la palabra, que es lo que hace el texto
 * publicado de este libro (campanile y lanterna aparecen marcadas 3 veces). */
function applyVocab(html: string, words: string[]) {
  let out = html;
  const applied: string[] = [];
  const missed: string[] = [];
  for (const word of words) {
    const label = word.charAt(0).toUpperCase() + word.slice(1);
    const re = new RegExp(`(?<![\\w>"])(${escapeRe(word)})(?![\\w<])`, "giu");
    let hits = 0;
    out = out.replace(re, (m0, m1) => {
      hits++;
      return `<span class="vocab-word" data-word="${label}">${m1}</span>`;
    });
    (hits ? applied : missed).push(word);
  }
  return { html: out, applied, missed };
}

function main() {
  const [src, dest, wordsArg] = process.argv.slice(2);
  const raw = readFileSync(src, "utf-8");
  const words = (wordsArg ?? "").split(",").map((w) => w.trim()).filter(Boolean);

  const bloques = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const piezas: string[] = [];

  for (const bloque of bloques) {
    const lineas = bloque.split(/\n/).map((l) => l.trim()).filter(Boolean);
    // Un bloque es de diálogo si TODAS sus líneas abren con "Nombre:".
    const esDialogo = lineas.every((l) => /^[^:]{1,24}:\s/.test(l));
    if (esDialogo) {
      for (const l of lineas) piezas.push(`<blockquote>${l}</blockquote>`);
    } else {
      piezas.push(`<p>${lineas.join(" ").replace(/\s+/g, " ")}</p>`);
    }
  }

  const html = piezas.join("\n\n");
  const { html: conVocab, applied, missed } = applyVocab(html, words);
  writeFileSync(dest, conVocab);

  const plano = conVocab.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  console.log(`bloques: ${bloques.length} | <p>=${(conVocab.match(/<p>/g) || []).length} <blockquote>=${(conVocab.match(/<blockquote>/g) || []).length}`);
  console.log(`palabras: ${plano.split(" ").length}`);
  console.log(`vocab marcado: ${applied.length}/${words.length}`);
  if (missed.length) console.log(`  NO encontradas: ${missed.join(", ")}`);
  console.log(`escrito: ${dest}`);
}

main();
