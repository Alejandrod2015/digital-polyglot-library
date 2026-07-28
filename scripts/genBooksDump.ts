// Regenera el dump estático `src/data/books/*.ts` desde la BD del catálogo
// (CatalogBook / CatalogStory), que es la fuente de verdad de la web.
//
// POR QUÉ EXISTE: la app móvil NO llama a la API para los libros; empaqueta
// este dump (apps/mobile/src/mobile/fullCatalog.ts -> src/data/books). Cuando
// el dump y la BD divergen, el móvil sirve contenido viejo en silencio. Pasó
// dos veces: la curación de vocabulario de 2026-05-22 solo llegó al dump (la
// web sirvió lo pre-curación 2 meses), y la subida de densidad de 2026-07-27
// solo llegó a la BD (el móvil se quedó en ~20 palabras por historia con las
// definiciones en español, y sin 3 de los 7 libros).
//
// Reutiliza getPublishedCatalogBooks() para que el mapeo fila -> Book sea el
// MISMO que usa la web; así el dump no puede desviarse de forma.
//
// Uso:
//   NODE_OPTIONS="--conditions=react-server -r dotenv/config" \
//   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/genBooksDump.ts [--dry]

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPublishedCatalogBooks } from "../src/lib/catalog";
import type { Book } from "@domain/types/books";

const DRY = process.argv.includes("--dry");
const OUT_DIR = join(process.cwd(), "src", "data", "books");

// Los ficheros existentes exportan el slug sin guiones (shortstoriesincolombianspanish).
// Mantengo la convención para que un diff del dump sea legible.
function exportName(slug: string): string {
  const name = slug.replace(/[^a-zA-Z0-9]/g, "");
  return /^[0-9]/.test(name) ? `book${name}` : name;
}

function bookFile(book: Book): string {
  return [
    "// GENERADO por scripts/genBooksDump.ts desde la BD del catálogo.",
    "// No editar a mano: el próximo regen lo pisa. Cambia la historia en la BD.",
    'import { Book } from "@/types/books";',
    "",
    `export const ${exportName(book.slug)}: Book = ${JSON.stringify(book, null, 2)};`,
    "",
  ].join("\n");
}

function indexFile(books: Book[]): string {
  const imports = books
    .map((b) => `import { ${exportName(b.slug)} } from "./${b.slug}";`)
    .join("\n");
  const entries = books
    .map((b) => `  [${exportName(b.slug)}.id]: ${exportName(b.slug)},`)
    .join("\n");
  return [
    "// GENERADO por scripts/genBooksDump.ts desde la BD del catálogo.",
    'import type { Book } from "@/types/books";',
    imports,
    "",
    "export const books: Record<string, Book> = {",
    entries,
    "};",
    "",
  ].join("\n");
}

async function main() {
  const books = await getPublishedCatalogBooks();
  if (books.length === 0) throw new Error("la BD no devolvió libros publicados; abortado");

  const sorted = [...books].sort((a, b) => a.slug.localeCompare(b.slug));

  console.log(`libro | historias | palabras de vocabulario`);
  let totalVocab = 0;
  for (const book of sorted) {
    const vocab = book.stories.reduce((n, s) => n + (s.vocab?.length ?? 0), 0);
    totalVocab += vocab;
    const missing = book.stories.filter((s) => !s.text || s.text.trim() === "");
    if (missing.length > 0) {
      throw new Error(`${book.slug}: ${missing.length} historias sin texto; abortado sin escribir`);
    }
    console.log(`${book.slug} | ${book.stories.length} | ${vocab}`);
    if (!DRY) writeFileSync(join(OUT_DIR, `${book.slug}.ts`), bookFile(book), "utf8");
  }
  if (!DRY) writeFileSync(join(OUT_DIR, "index.ts"), indexFile(sorted), "utf8");

  console.log(
    `\n${DRY ? "DRY (nada escrito)" : "escrito"}: ${sorted.length} libros, ` +
      `${sorted.reduce((n, b) => n + b.stories.length, 0)} historias, ${totalVocab} entradas de vocabulario`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
