// Scrub character names from vocab arrays + texts en catálogo.
//
// Heurística: en cada historia, extrae todos los speaker labels
// (patrón `Nombre:` al inicio de blockquote/línea) → conjunto de
// nombres propios. Cada vocab item cuyo `word` matchee uno de esos
// nombres se borra. También se quita su `<span class="vocab-word"
// data-word="Word">Word</span>` del HTML del texto, dejando el
// texto plano.
//
// Conserva: vocab items que matcheen roles/títulos legítimos
// (Guardabosques, Profe, Don, Doña) — sólo se eliminan first
// names, no roles. Heurística: si el token aparece TANTO solo como
// speaker label (e.g. "Mateo:") como también precedido de un rol
// (e.g. "Guardabosques Julio:"), se considera nombre propio. Roles
// puros (que aparecen como speaker sin nombre adicional, p.ej.
// "Profe:") permanecen.
//
// Pasa --apply para escribir. Sin flag = dry-run.

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = resolve(__dirname, "../src/data/books");
const APPLY = process.argv.includes("--apply");

// Roles/títulos explícitos que NUNCA borramos.
const PROTECTED_ROLES = new Set(
  [
    "Guía", "Guia", "Guardabosques", "Profe", "Profesor", "Profesora",
    "Maestro", "Maestra", "Don", "Doña", "Señor", "Señora", "Vendedor",
    "Vendedora", "Doctor", "Doctora", "Capitán", "Sargento", "Madre",
    "Padre", "Abuelo", "Abuela", "Hijo", "Hija", "Tío", "Tía", "Primo",
    "Prima", "Chef", "Camarero", "Mesero", "Mesera", "Cocinero",
    "Cocinera", "Conductor", "Pasajero", "Pasajera", "Cliente",
    "Mecánico", "Policía", "Cura", "Mama", "Mamá", "Papa", "Papá",
    "Chofer", "Desconocido", "Desconocida", "Bibliotecario",
    "Bibliotecaria", "Taquero", "Taquera", "Panadero", "Panadera",
    "Carnicero", "Carnicera", "Tendero", "Tendera", "Niño", "Niña",
    "Joven", "Anciano", "Anciana", "Hombre", "Mujer", "Amigo", "Amiga",
    "Vecino", "Vecina", "Turista", "Visitante", "Guía Turística",
  ].map((w) => w.toLowerCase())
);

// Heurística morfológica: termina en -ero/-era/-or/-ora/-ista
// (job suffix español) → es role, no nombre. Único nombre común
// que la rompe: "Doctor" ya está en lista explícita.
function isLikelyRoleByMorph(wordLc) {
  return /(?:ero|era|or|ora|ista|ico|ica|ante|ente)$/.test(wordLc);
}

function loadBook(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const cleaned = raw
    .replace(/^import .*$/gm, "")
    .replace(/^export\s+const\s+\w+\s*:\s*Book\s*=\s*/m, "module.exports = ")
    .replace(/^export\s+const\s+\w+\s*=\s*/m, "module.exports = ");
  const exports = {};
  const module = { exports };
  const fn = new Function("module", "exports", cleaned);
  fn(module, exports);
  return module.exports;
}

// Extrae los tokens que actúan como SPEAKER labels en el texto.
// Patrones:
//   <blockquote>Nombre: ...</blockquote>
//   <blockquote>Rol Nombre: ...</blockquote>
//   Nombre: ... (en líneas planas)
// Devuelve set de tokens en lowercase.
function extractSpeakerNames(text) {
  const speakerNames = new Set();
  // Patrón: principio de blockquote (o de línea) → palabras
  // capitalizadas → ":"
  const re = /(?:<blockquote>|<p>|^|\n)\s*((?:[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:\s+[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+){0,3}))\s*:/g;
  let m;
  while ((m = re.exec(text))) {
    const label = m[1];
    // Split por espacio: cada token capitalizado es candidato.
    const tokens = label.split(/\s+/);
    for (const tok of tokens) {
      const lc = tok.toLowerCase();
      // Saltamos roles protegidos.
      if (PROTECTED_ROLES.has(lc)) continue;
      speakerNames.add(lc);
    }
  }
  return speakerNames;
}

// Limpia un texto HTML quitando los <span class="vocab-word"
// data-word="X">X</span> donde X matchea alguno de los lc names.
function stripVocabSpans(text, namesLc) {
  return text.replace(
    /<span\s+class="vocab-word"\s+data-word="([^"]+)">([^<]+)<\/span>/gi,
    (whole, word, inner) => {
      if (namesLc.has(word.toLowerCase())) return inner;
      return whole;
    }
  );
}

// Re-serializa el book como TS preservando la forma original. Como
// estamos cargando con `new Function`, el round-trip puede perder
// estilo. Estrategia: edición textual directa sobre el contenido raw.
// Más seguro: regex para encontrar cada `"word": "X"` + def y borrar
// el item del array vocab del bloque correspondiente. Demasiado
// frágil — mejor regenerar con JSON.stringify del objeto modificado.
function reserialize(book) {
  return `import { Book } from "@/types/books";\n\nexport const ${book.id.replace(/-/g, "")}: Book = ${JSON.stringify(book, null, 2)};\n`;
}

function main() {
  const files = readdirSync(BOOKS_DIR).filter(
    (f) => f.endsWith(".ts") && f !== "index.ts"
  );

  const report = [];
  let totalRemoved = 0;
  let totalScanned = 0;

  for (const f of files) {
    const path = resolve(BOOKS_DIR, f);
    let book;
    try {
      book = loadBook(path);
    } catch (e) {
      console.warn(`Skipping ${f}: ${e.message}`);
      continue;
    }

    let bookChanged = false;
    const bookReport = { file: f, title: book.title, removed: [] };

    for (const story of book.stories ?? []) {
      const text = story.text ?? "";
      const speakers = extractSpeakerNames(text);
      const vocab = Array.isArray(story.vocab) ? story.vocab : [];
      totalScanned += vocab.length;

      // 1. Quitar de vocab[] los items cuyo word matchea un speaker.
      const filtered = [];
      const removedFromStory = [];
      for (const v of vocab) {
        const word = (v.word ?? "").trim();
        const wordLc = word.toLowerCase();
        if (speakers.has(wordLc) && !PROTECTED_ROLES.has(wordLc) && !isLikelyRoleByMorph(wordLc)) {
          removedFromStory.push(word);
          totalRemoved += 1;
          continue;
        }
        filtered.push(v);
      }

      if (removedFromStory.length > 0) {
        // 2. También quitar los spans correspondientes del texto
        // (si existían como `<span data-word="Nombre">`).
        const namesLc = new Set(removedFromStory.map((n) => n.toLowerCase()));
        story.text = stripVocabSpans(text, namesLc);
        story.vocab = filtered;
        bookChanged = true;
        bookReport.removed.push({ storyTitle: story.title, removed: removedFromStory });
      }
    }

    if (bookChanged) {
      report.push(bookReport);
      if (APPLY) {
        // Edición line-based: vocab items son objetos {…} en líneas
        // separadas. Para cada name a borrar, encontramos la línea con
        // `"word": "Name"`, subimos hasta la `{` solitaria que abre el
        // objeto y bajamos hasta el `},` o `}` que lo cierra, marcamos
        // ese rango para borrar. Después colapsamos. Mucho más seguro
        // que regex sobre raw para JSON nested.
        const lines = readFileSync(path, "utf8").split("\n");
        const toDelete = new Set();
        for (const { removed } of bookReport.removed) {
          for (const name of removed) {
            const needle = `"word": "${name}"`;
            for (let i = 0; i < lines.length; i++) {
              if (!lines[i].includes(needle)) continue;
              let start = i;
              while (start > 0 && !/^\s*\{\s*$/.test(lines[start])) start--;
              let end = i;
              while (end < lines.length - 1 && !/^\s*\},?\s*$/.test(lines[end])) end++;
              for (let j = start; j <= end; j++) toDelete.add(j);
              break;
            }
          }
        }
        let raw = lines.filter((_, idx) => !toDelete.has(idx)).join("\n");
        // Limpiar coma final antes de `]` que pudo quedar tras el borrado.
        raw = raw.replace(/,(\s*\])/g, "$1");
        // Quitar los <span class="vocab-word" data-word="Name"> del text.
        for (const { removed } of bookReport.removed) {
          for (const name of removed) {
            const spanRe = new RegExp(
              `<span\\s+class=\\\\"vocab-word\\\\"\\s+data-word=\\\\"${escapeRegex(name)}\\\\">([^<]+)<\\/span>`,
              "gi"
            );
            raw = raw.replace(spanRe, "$1");
          }
        }
        writeFileSync(path, raw);
      }
    }
  }

  console.log(`Scanned ${totalScanned} vocab items across ${files.length} books.`);
  console.log(`Identified ${totalRemoved} character-name vocab items.\n`);
  for (const r of report) {
    console.log(`📖 ${r.title}`);
    for (const { storyTitle, removed } of r.removed) {
      console.log(`   "${storyTitle}" → ${removed.join(", ")}`);
    }
  }

  if (!APPLY) {
    console.log(`\n[DRY RUN] Pass --apply to write.`);
  } else {
    console.log(`\n→ Files written.`);
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main();
