/** Reproduce el caso "Fix 1": UNA palabra fallada, sin oracion de ejemplo. */
import { buildPracticeSession, type PracticeFavoriteItem } from "../src/lib/practiceExercises";

const target: PracticeFavoriteItem = {
  word: "die Schramme", translation: "the scratch", wordType: "noun",
  exampleSentence: null, storySlug: "duzen-auf-eigene-gefahr", storyTitle: "t",
  sourcePath: "/stories/duzen-auf-eigene-gefahr", language: "german",
  nextReviewAt: null, practiceSource: "user_saved", voiceId: null,
};
const companions: PracticeFavoriteItem[] = ["der Zettel","die Etage","der Feierabend","die Anrede","der Vertrag","die Landkarte"]
  .map((w, i) => ({ ...target, word: w, translation: `gloss ${i}`, exampleSentence: null }));

const norm = (v?: string | null) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const key = norm(target.word);
for (const mode of ["meaning", "listening"] as const) {
  const built = buildPracticeSession([target, ...companions], mode);
  const mine = built.find((e) =>
    (e.type === "meaning_in_context" && norm(e.word) === key) ||
    (e.type === "listen_choose" && norm(e.answer) === key));
  console.log(`${mode.padEnd(10)} -> ${built.length} ejercicios, para la palabra fallada: ${mine ? "SI (" + mine.type + ")" : "NO"}`);
}
