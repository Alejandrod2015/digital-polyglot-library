/**
 * Expande la fuente compacta de los sets del Traveler PT-BR B1
 * (scripts/_ptB1Src/<slug>.json) al formato de referencia de
 * scripts/_sets/<slug>.json. Solo escribe ficheros; no toca la base.
 *
 * Fuente:
 *   { "slug", "match": [[palabra, glosa] x4],
 *     "items": [
 *       ["m", lema, "frase con [[superficie]]", respuesta, d1, d2, d3],
 *       ["f", forma, "frase con _____", "traduccion con _____", tradRespuesta,
 *         [d1, trad1], [d2, trad2], [d3, trad3]] ] }
 * Los 10 primeros ejercicios (el match cuenta como uno) van destacados; el
 * resto va al pool.
 *
 * Uso: npx tsx scripts/_ptB1BuildSets.ts [slug...]
 */
import * as fs from "fs";

const SRC = "scripts/_ptB1Src";
const OUT = "scripts/_sets";
const only = process.argv.slice(2);

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith(".json")).sort()) {
  const src = JSON.parse(fs.readFileSync(`${SRC}/${f}`, "utf8"));
  if (only.length && !only.includes(src.slug)) continue;
  const clip = (sentence: string, targetWord: string) => ({
    storySlug: src.slug, storySource: "user", sentence, targetWord, language: "portuguese",
  });
  const glosses = src.match.map((p: string[]) => p[1]);
  const exs: any[] = [{
    type: "match_meaning",
    word: src.match.map((p: string[]) => p[0]).join(","),
    sentence: "",
    payload: {
      prompt: "Match the words to their meanings.",
      pairs: src.match.map((p: string[]) => ({ word: p[0], answer: p[1], options: glosses })),
      audioClip: null,
    },
  }];
  for (const it of src.items) {
    if (it[0] === "m") {
      const [, word, sentence, answer, ...ds] = it;
      const surface = /\[\[(.+?)\]\]/.exec(sentence)?.[1] ?? "";
      exs.push({
        type: "meaning_in_context", word, sentence,
        payload: {
          prompt: "Choose the meaning in context.", answer, options: [answer, ...ds],
          audioClip: clip(sentence.replace(/\[\[|\]\]/g, ""), surface),
        },
      });
    } else {
      const [, word, sentence, translation, ansTr, ...ds] = it;
      exs.push({
        type: "fill_blank", word, sentence,
        payload: {
          prompt: "Complete the sentence.", answer: word,
          options: [word, ...ds.map((d: string[]) => d[0])],
          translation,
          optionTranslations: [ansTr, ...ds.map((d: string[]) => d[1])],
          audioClip: clip(sentence.replace(/_{3,}/, word), word),
        },
      });
    }
  }
  exs.forEach((e, i) => { if (i >= 10) e.featured = false; });
  fs.writeFileSync(`${OUT}/${src.slug}.json`, JSON.stringify(exs, null, 2) + "\n");
  console.log(`${src.slug}: ${exs.length} ex`);
}
