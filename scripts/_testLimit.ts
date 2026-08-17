import { buildPracticeSession } from "../src/lib/practiceExercises";

const longS = "Zwischen klappernden Tassen, dem Duft frisch gemahlener Bohnen und dem leisen Stimmengewirr am Tresen merkt Mara, dass ein kurzer Kaffee schnell zum Feierabendgespräch werden kann."; // 178
const shortS = "Der Automat druckt: B 247.";

const items = [
  { word: "Duft", translation: "aroma", exampleSentence: longS, storySlug: "journey-x", sourcePath: "/books/standalone-stories/x", language: "german" },
  { word: "Automat", translation: "machine", exampleSentence: shortS, storySlug: "journey-x", sourcePath: "/books/standalone-stories/x", language: "german" },
  { word: "Tresen", translation: "counter", exampleSentence: "Er steht am Tresen.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/x", language: "german" },
  { word: "Kaffee", translation: "coffee", exampleSentence: "Sie trinkt Kaffee.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/x", language: "german" },
] as never[];

for (const mode of ["context", "meaning", "listening"] as const) {
  const exs = buildPracticeSession(items, mode) as any[];
  const words = exs.map((e) => e.word ?? e.answer);
  const duftIn = exs.some((e) => (e.word === "Duft" || e.answer === "Duft"));
  console.log(`[${mode}] ejercicios=${exs.length} palabras=${JSON.stringify(words)} | Duft(largo) incluido: ${duftIn}`);
  const ctx = exs.find((e) => e.type === "fill_blank" && e.answer === "Automat");
  if (ctx) {
    const unblanked = (ctx.sentence || "").replace(/_{3,}/g, ctx.answer);
    console.log(`   Automat context: texto="${ctx.sentence}" audio="${ctx.audioClip?.sentence}" match=${unblanked === ctx.audioClip?.sentence}`);
  }
}
