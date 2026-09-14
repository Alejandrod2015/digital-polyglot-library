// SOLO LECTURA. Cuanto audio de practica falta en el Friends FR A0: clips de
// palabra (meaning_in_context) y de oracion (fill_blank), con sus caracteres.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { id: true, slug: true } });
  const sets: any[] = await (p as any).storyPracticeSet.findMany({ where: { storyId: { in: st.map((s) => s.id) } }, select: { storyId: true, exercises: { select: { type: true, word: true, payload: true } } } });
  let wFalta = 0, wHay = 0, wChars = 0, fFalta = 0, fHay = 0, fChars = 0;
  for (const set of sets) for (const e of set.exercises) {
    const pay: any = e.payload ?? {};
    if (e.type === "meaning_in_context") {
      // El clip de palabra vive en payload.audioClip.wordClipUrl, que es donde
      // lo escribe _genWordClips.ts. Leerlo en la raiz (pay.wordClipUrl) daba
      // "hay 0" SIEMPRE, antes y despues de generar los 272: un campo que no
      // existe no distingue el trabajo hecho del pendiente.
      if (pay.audioClip?.wordClipUrl) wHay++; else { wFalta++; wChars += String(pay.audioClip?.targetWord ?? e.word).length; }
    }
    if (e.type === "fill_blank") {
      const frase = String(pay.audioClip?.sentence ?? "");
      if (pay.audioClip?.clipUrl) fHay++; else { fFalta++; fChars += frase.length; }
    }
  }
  console.log(`palabra (meaning_in_context): faltan ${wFalta}, hay ${wHay}, ${wChars} caracteres`);
  console.log(`oracion (fill_blank):        faltan ${fFalta}, hay ${fHay}, ${fChars} caracteres`);
  console.log(`TOTAL a sintetizar: ${wFalta + fFalta} clips, ${wChars + fChars} caracteres`);
  await p.$disconnect();
})();
