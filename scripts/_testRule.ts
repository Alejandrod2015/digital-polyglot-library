import { buildPracticeSession } from "../src/lib/practiceExercises";

const items = [
  // limpio, 1 oración, 76 chars → DEBE entrar en context
  { word: "Sprung", translation: "jump", exampleSentence: "Sie steht da wie jemand auf dem Sprung, und trotzdem hängt Müdigkeit an ihr.", storySlug: "journey-x", sourcePath: "/books/x/y", language: "german" },
  // diálogo, 1 oración pero 114 chars > 100 → NO debe entrar
  { word: "Fahrkarte", translation: "ticket", exampleSentence: "„Ich kann es kaum erwarten, dich zu sehen!“, hatte ihre Freundin Anna gesagt, als sie die Fahrkarte gebucht hatte.", storySlug: "journey-x", sourcePath: "/books/x/y", language: "german" },
  // párrafo multi-oración → NO debe entrar
  { word: "caminar", translation: "walk", exampleSentence: "Es martes por la mañana. Marta camina rápido hacia un café pequeño en la esquina.", storySlug: "journey-x", sourcePath: "/books/x/y", language: "spanish" },
  // relleno para distractores
  { word: "Tasse", translation: "cup", exampleSentence: "Er trinkt aus der Tasse.", storySlug: "journey-x", sourcePath: "/books/x/y", language: "german" },
  { word: "Zug", translation: "train", exampleSentence: "Der Zug kommt spät.", storySlug: "journey-x", sourcePath: "/books/x/y", language: "german" },
] as never[];

for (const mode of ["context", "listening"] as const) {
  const exs = buildPracticeSession(items, mode) as any[];
  const words = exs.map((e) => e.word ?? e.answer);
  console.log(`[${mode}] palabras=${JSON.stringify(words)}`);
  if (mode === "context") {
    for (const e of exs) console.log(`   ${e.answer}: "${e.sentence}" (${(e.sentence || "").length})`);
  }
}
