import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

// Junk classes the 2026-05-22 dump commit scrubbed: character names and
// high-frequency function words used as "vocabulary".
const FUNCTION_WORDS = new Set([
  "algo", "vos", "tampoco", "ciudad", "hombre", "noche", "casa", "cosa", "gente",
  "dia", "día", "vez", "todo", "nada", "poco", "mucho", "bien", "mal", "aqui", "aquí",
  "ahora", "siempre", "nunca", "tambien", "también", "porque", "cuando", "donde", "dónde",
  "mujer", "nino", "niño", "ano", "año", "tiempo", "mano", "ojo", "agua", "calle",
]);

async function main() {
  const books = await p.catalogBook.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: { stories: true },
  });

  for (const b of books) {
    const names = new Set<string>();
    const funcs = new Set<string>();
    for (const s of b.stories) {
      const vocab = Array.isArray(s.vocab) ? (s.vocab as { word?: string }[]) : [];
      const plain = (s.text ?? "").replace(/<[^>]+>/g, " ");
      for (const v of vocab) {
        const w = (v?.word ?? "").trim();
        if (!w) continue;
        const lower = w.toLowerCase();
        if (FUNCTION_WORDS.has(lower)) funcs.add(w);
        // Proper-name heuristic: capitalized single token, appears mid-sentence
        // capitalized in the text, and is not a known cultural term.
        if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(w)) {
          const midSentence = new RegExp(`[a-záéíóúñ,] ${w}\\b`).test(plain);
          if (midSentence) names.add(w);
        }
      }
    }
    console.log(
      `${b.slug.padEnd(52)} funcWords=${funcs.size} ${funcs.size ? "[" + [...funcs].slice(0, 10).join(", ") + "]" : ""}`
    );
    console.log(`${" ".repeat(52)} properNames=${names.size} ${names.size ? "[" + [...names].slice(0, 12).join(", ") + "]" : ""}`);
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
