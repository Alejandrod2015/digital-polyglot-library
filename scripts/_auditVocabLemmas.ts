/**
 * Cuenta cuántos items de vocab del A2 España guardan una forma FLEXIONADA en
 * `word` en vez del lema. El contrato del proyecto (resolveCanonicalVocabEntry)
 * es `word` = lema y `surface` = la forma que aparece en el texto.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { resolveCanonicalVocabEntry } from "../src/lib/vocabWordNormalization";
import * as fs from "fs";

const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
  slug: string; vocab: Array<{ word: string; type?: string; surface?: string }>;
}>;

let total = 0, differ = 0;
const examples: string[] = [];
for (const s of stories) {
  for (const v of s.vocab) {
    total++;
    const { word: lemma } = resolveCanonicalVocabEntry({
      word: v.word, surface: v.surface ?? v.word, type: v.type, language: "spanish",
    });
    if (lemma.toLowerCase() !== v.word.toLowerCase()) {
      differ++;
      if (examples.length < 25) examples.push(`${v.word} → ${lemma} (${v.type}, ${s.slug})`);
    }
  }
}
console.log(`items: ${total}  ·  guardan forma flexionada en word: ${differ} (${Math.round((differ / total) * 100)}%)  ·  con surface: 0`);
console.log(`\nejemplos:`);
for (const e of examples) console.log("  " + e);
