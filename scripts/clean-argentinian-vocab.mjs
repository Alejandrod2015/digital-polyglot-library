// Limpia el vocab del libro argentino sin tocar el texto de las
// historias (per instrucción del usuario). Tres pasadas:
//
//   1. Drop items cuya `definition` está en español (heurística:
//      empieza con un noun-phrase español + verbo "es/son" → es
//      una definición circular típica del bad pipeline).
//      Mantenemos las que están en inglés.
//
//   2. Drop items cuya `word` está en lista de palabras universales
//      (esto, igual, vos, aire, gente, horas, café, música,
//      sonrisa, cerebro, ...) — no aportan a un aprendiz anglosajón.
//
//   3. Inject `<span class="vocab-word" data-word="X">X</span>` en
//      el texto de la historia para CADA vocab item sobreviviente,
//      en su PRIMERA aparición. Sólo afecta texto plano (fuera de
//      tags HTML existentes) y respeta word boundaries.
//
// Resultado: lista de vocab más corta y de mejor calidad, +
// popups funcionando. NO reescribimos definiciones (eso queda
// para un pase editorial separado).

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(
  __dirname,
  "../src/data/books/short-stories-in-argentinian-spanish-for-beginners.ts"
);
const APPLY = process.argv.includes("--apply");

// Palabras universales — un aprendiz anglosajón a nivel beginner
// ya las reconoce o no necesita explicación. Lista conservadora.
const UNIVERSAL = new Set(
  [
    // Pronouns + determiners
    "vos", "tú", "usted", "yo", "él", "ella", "nosotros", "ellos",
    "esto", "eso", "aquello", "este", "esta", "ese", "esa",
    "mí", "ti", "mi", "tu", "su",
    // Common quantifiers / modifiers
    "igual", "mismo", "siempre", "nunca", "todo", "nada", "algo",
    "mucho", "poco", "más", "menos", "muy", "tan", "ya", "aún",
    "también", "tampoco", "solo", "sólo", "bien", "mal",
    // Basic adjectives
    "bueno", "buena", "malo", "mala", "grande", "pequeño", "pequeña",
    "nuevo", "nueva", "viejo", "vieja",
    // Basic time
    "hora", "horas", "minuto", "minutos", "día", "días", "año", "años",
    "hoy", "ayer", "mañana", "noche", "tarde",
    // Basic places
    "casa", "calle", "ciudad", "país", "lugar",
    // Basic body / objects (English speaker knows)
    "café", "té", "agua", "música", "arte", "tango",
    "sonrisa", "cerebro", "gente", "persona", "hombre", "mujer",
    "amigo", "amiga", "familia", "padre", "madre", "hijo", "hija",
    "aire", "fuego", "tierra", "sol", "luna",
    // Basic verbs (cognates or covered in week 1)
    "ser", "estar", "tener", "haber", "ir", "venir", "ver", "dar",
    "saber", "querer", "poder", "comer", "beber", "dormir",
    "vivir", "amar", "decir", "hablar",
    // Filler / interjection
    "dale", "che", "ok", "okay", "hola", "adiós", "gracias",
  ].map((w) => w.toLowerCase())
);

function norm(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Heurística: la definition está en español?
//   - Contiene "es un/una" o "son un/unas" → muy probablemente tautológica
//   - Contiene palabras españolas comunes que rara vez van en
//     definiciones inglés ("y", "que", "para", "con", "sobre", "del")
function isSpanishDefinition(def) {
  if (!def) return false;
  const d = ` ${def.toLowerCase()} `;
  // Definiciones tipo "X es un/una Y..." son redundantes (X aparece
  // en su propia definición). Bandera fuerte.
  if (/\b(es un|es una|son un|son unos|son unas|es el|es la)\b/.test(d)) return true;
  // Conectores español-only frecuentes.
  const spanishHits = (d.match(/\b(que|para|con|del|por|los|las|del|al|en el|en la)\b/g) ?? []).length;
  return spanishHits >= 2;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Wrap PRIMERA ocurrencia de `word` en `text` con span vocab-word,
// sin tocar el contenido dentro de tags HTML existentes.
function injectFirstSpan(text, word) {
  // Si ya existe un span con data-word="word" → no hacer nada.
  const existingRe = new RegExp(
    `data-word="${escapeRegex(word)}"`,
    "i"
  );
  if (existingRe.test(text)) return text;

  // Split text en segmentos: dentro-de-tag vs fuera-de-tag.
  // Match en la primera ocurrencia FUERA-de-tag, word-bounded.
  // Pasamos linealmente respetando depth de tag.
  let result = "";
  let i = 0;
  let inTag = false;
  let inserted = false;
  const wordRe = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escapeRegex(word)})(?=$|[^\\p{L}\\p{N}_])`,
    "iu"
  );
  while (i < text.length) {
    if (!inTag && text[i] === "<") {
      inTag = true;
      result += text[i];
      i += 1;
      continue;
    }
    if (inTag && text[i] === ">") {
      inTag = false;
      result += text[i];
      i += 1;
      continue;
    }
    if (inTag || inserted) {
      result += text[i];
      i += 1;
      continue;
    }
    // Try match starting at i
    const slice = text.slice(i);
    const m = slice.match(wordRe);
    if (m && m.index === 0) {
      const leading = m[1];
      const matched = m[2];
      result +=
        leading +
        `<span class="vocab-word" data-word="${word}">${matched}</span>`;
      i += leading.length + matched.length;
      inserted = true;
    } else {
      result += text[i];
      i += 1;
    }
  }
  return result;
}

function loadBook() {
  const raw = readFileSync(FILE, "utf8");
  const cleaned = raw
    .replace(/^import .*$/gm, "")
    .replace(/^export\s+const\s+\w+\s*:\s*Book\s*=\s*/m, "module.exports = ");
  const exports = {};
  const module = { exports };
  const fn = new Function("module", "exports", cleaned);
  fn(module, exports);
  return { book: module.exports, raw };
}

function main() {
  const { book, raw } = loadBook();
  const report = [];

  let totalRemoved = 0;
  let totalSpansInjected = 0;

  for (const story of book.stories ?? []) {
    const before = (story.vocab ?? []).length;
    const filtered = [];
    const dropped = [];

    for (const v of story.vocab ?? []) {
      const word = (v.word ?? "").trim();
      const def = (v.definition ?? "").trim();
      const wordLc = norm(word);

      if (UNIVERSAL.has(wordLc)) {
        dropped.push({ word, reason: "universal" });
        continue;
      }
      if (isSpanishDefinition(def)) {
        dropped.push({ word, reason: "spanish-def" });
        continue;
      }
      filtered.push(v);
    }

    story.vocab = filtered;
    totalRemoved += dropped.length;

    // Inyectar spans para los items sobrevivientes (en orden, primera
    // ocurrencia de cada uno).
    let text = story.text ?? "";
    let injectedCount = 0;
    for (const v of filtered) {
      const word = (v.word ?? "").trim();
      if (!word) continue;
      const newText = injectFirstSpan(text, word);
      if (newText !== text) {
        injectedCount += 1;
        text = newText;
      }
    }
    story.text = text;
    totalSpansInjected += injectedCount;

    report.push({
      title: story.title,
      before,
      after: filtered.length,
      dropped,
      injected: injectedCount,
    });
  }

  // Report
  for (const r of report) {
    console.log(`📖 ${r.title}`);
    console.log(`   vocab ${r.before} → ${r.after}  (-${r.dropped.length})  spans injected: ${r.injected}`);
    if (r.dropped.length > 0) {
      const universals = r.dropped.filter((d) => d.reason === "universal").map((d) => d.word);
      const sps = r.dropped.filter((d) => d.reason === "spanish-def").map((d) => d.word);
      if (universals.length) console.log(`   universal: ${universals.join(", ")}`);
      if (sps.length) console.log(`   spanish-def: ${sps.join(", ")}`);
    }
  }
  console.log(`\nTotal removed: ${totalRemoved}.  Total spans injected: ${totalSpansInjected}.`);

  if (!APPLY) {
    console.log(`\n[DRY RUN] Pass --apply to write.`);
    return;
  }

  // Write back: edición line-based para drop + line-based para text
  // update. Más seguro reconstruir el archivo con stringify.
  const out = `import { Book } from "@/types/books";\n\nexport const shortstoriesinargentinianspanishforbeginners: Book = ${JSON.stringify(book, null, 2)};\n`;
  writeFileSync(FILE, out);
  console.log(`→ ${FILE} rewritten.`);
}

main();
