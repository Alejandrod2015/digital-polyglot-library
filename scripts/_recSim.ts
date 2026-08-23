// Simula getRecommendedPracticeModeFromItems con los favoritos REALES de cada
// usuario, con el peso actual de context (+2) y con el propuesto (+1).
import { PrismaClient } from "../src/generated/prisma";

type Item = { word: string; wordType: string | null; exampleSentence: string | null; storySlug: string | null; language: string | null; nextReviewAt: Date | null };

function isExpr(i: Item) {
  const w = (i.word ?? "").trim();
  const t = (i.wordType ?? "").toLowerCase();
  return w.includes(" ") || /expression|phrase|idiom|chunk|connector/.test(t);
}

function recommend(items: Item[], ctxWeight: number): string {
  const now = Date.now();
  const due = items.filter((i) => !i.nextReviewAt || i.nextReviewAt.getTime() <= now);
  if (due.length === 0) {
    if (items.some((i) => i.exampleSentence?.trim())) return "context";
    if (items.length >= 6) return "match";
    return "meaning";
  }
  const counts: Record<string, number> = { meaning: 0, context: 0, listening: 0, match: 0 };
  for (const i of due) {
    counts.meaning += 1;
    if (i.exampleSentence?.trim()) counts.context += ctxWeight;
    if (i.storySlug || i.language) counts.listening += 1;
    if (isExpr(i)) counts.context += 1;
  }
  if (due.length >= 6) counts.match += 2;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

async function main() {
  const prisma = new PrismaClient();
  const favs = await prisma.favorite.findMany({
    select: { userId: true, word: true, wordType: true, exampleSentence: true, storySlug: true, language: true, nextReviewAt: true },
  });
  const byUser = new Map<string, Item[]>();
  for (const f of favs) {
    const list = byUser.get(f.userId) ?? [];
    list.push(f);
    byUser.set(f.userId, list);
  }
  const tally = new Map<string, number>();
  for (const [, items] of byUser) {
    const k = `${recommend(items, 2)} -> ${recommend(items, 1)}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }
  console.log(`usuarios con favoritos: ${byUser.size}   favoritos: ${favs.length}`);
  console.log("actual(+2) -> propuesto(+1)   usuarios");
  for (const [k, v] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
  await prisma.$disconnect();
}
main();
