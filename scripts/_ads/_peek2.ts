import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const title of ["La once con chirrido", "Los aguanto de dos en dos"]) {
    const s = await p.journeyStory.findFirst({ where: { title }, select: { id: true, text: true, vocab: true, audioWordTimings: true, journey: { select: { variant: true, status: true, typeSlug: true, levels: true } } } });
    const tim = s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }> };
    console.log("====", title, JSON.stringify(s?.journey));
    console.log((s?.text || "").slice(0, 520));
    console.log(tim.words.map((w, i) => `${i}:${w.text}`).join(" ").slice(0, 1500));
    const set = await p.storyPracticeSet.findFirst({ where: { storyId: s?.id }, select: { exercises: { select: { type: true, word: true, sentence: true, payload: true } } } });
    for (const e of set?.exercises || []) if (e.type === "meaning_in_context") console.log("MEANING:", e.word, "|", e.sentence, "|", JSON.stringify((e.payload as any).options), "->", (e.payload as any).answer);
  }
  await p.$disconnect();
})();
