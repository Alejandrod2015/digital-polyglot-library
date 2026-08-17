import { buildPracticeSession } from "../src/lib/practiceExercises";

const items = [
  { word: "mäßig", translation: "moderately", exampleSentence: "Herr Menzel blättert durch ihre Unterlagen wie durch eine Zeitschrift, die ihn mäßig interessiert.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
  { word: "blättern", translation: "to leaf through", exampleSentence: "Er blättert langsam.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
  { word: "Zeitschrift", translation: "magazine", exampleSentence: "Die Zeitschrift liegt dort.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
  { word: "Unterlagen", translation: "documents", exampleSentence: "Die Unterlagen sind hier.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
  { word: "interessieren", translation: "to interest", exampleSentence: "Das interessiert ihn.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
  { word: "Menzel", translation: "name", exampleSentence: "Herr Menzel kommt.", storySlug: "journey-x", sourcePath: "/books/standalone-stories/zwei", language: "german" },
] as never[];

const ex = buildPracticeSession(items, "context").find((e: any) => e.type === "fill_blank" && e.answer?.toLowerCase().includes("mäßig")) as any;
if (!ex) { console.log("no fill_blank para mäßig (¿fue a otro modo?); muestro el primero:"); const f = buildPracticeSession(items, "context")[0] as any; console.log("TEXTO:", JSON.stringify(f?.sentence)); console.log("AUDIO:", JSON.stringify(f?.audioClip?.sentence)); }
else {
  console.log("TEXTO mostrado:", JSON.stringify(ex.sentence));
  console.log("AUDIO (audioClip.sentence):", JSON.stringify(ex.audioClip?.sentence));
  const unblanked = (ex.sentence || "").replace(/_{3,}/g, ex.answer);
  console.log("MATCH (display unblanked == audio):", unblanked === ex.audioClip?.sentence);
}
