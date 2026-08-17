import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const id = "spe_mrwd2yf3edifjmd";
  const e = await p.storyPracticeExercise.findUnique({ where: { id }, select: { payload: true } });
  const pl = e!.payload as any;
  pl.answer = "puntadas";
  pl.options = pl.options.map((o: string) => (o === "puntada" ? "puntadas" : o));
  pl.audioClip.sentence = pl.audioClip.sentence.replace("las puntada de", "las puntadas de");
  pl.audioClip.targetWord = "puntadas";
  await p.storyPracticeExercise.update({ where: { id }, data: { word: "puntadas", payload: pl } });
  // verificar
  const after = await p.storyPracticeExercise.findUnique({ where: { id }, select: { word: true, payload: true } });
  const ac = (after!.payload as any);
  console.log("word:", after!.word);
  console.log("answer:", ac.answer);
  console.log("options:", JSON.stringify(ac.options));
  console.log("audioClip.sentence:", ac.audioClip.sentence);
  console.log("audioClip.targetWord:", ac.audioClip.targetWord);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
