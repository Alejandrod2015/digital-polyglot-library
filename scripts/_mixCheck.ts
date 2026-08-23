// Verifica el reparto REAL de una tanda mixta con los favoritos de usuarios
// reales, y lo compara con lo que servía antes (una tanda de un solo modo).
import { PrismaClient } from "../src/generated/prisma";
import { buildMixedPracticeSession, buildPracticeSession, MIXED_PRACTICE_PLAN } from "../src/lib/practiceExercises";

const modeOf = (e: { type: string }) =>
  e.type === "fill_blank" ? "context" : e.type === "meaning_in_context" ? "meaning" : e.type === "listen_choose" ? "listening" : "match";

async function main() {
  const prisma = new PrismaClient();
  const favs = await prisma.favorite.findMany({
    select: { userId: true, word: true, translation: true, wordType: true, exampleSentence: true, storySlug: true, storyTitle: true, sourcePath: true, language: true, nextReviewAt: true },
  });
  const byUser = new Map<string, any[]>();
  for (const f of favs) {
    const item = { ...f, nextReviewAt: f.nextReviewAt ? f.nextReviewAt.toISOString() : null };
    byUser.set(f.userId, [...(byUser.get(f.userId) ?? []), item]);
  }
  const antes = new Map<string, number>();
  const despues = new Map<string, number>();
  let tandas = 0;
  for (const [, items] of byUser) {
    if (items.length < 4) continue;
    tandas += 1;
    for (const e of buildPracticeSession(items, "context").slice(0, 10)) antes.set(modeOf(e), (antes.get(modeOf(e)) ?? 0) + 1);
    for (const e of buildMixedPracticeSession(items, MIXED_PRACTICE_PLAN, 10)) despues.set(modeOf(e), (despues.get(modeOf(e)) ?? 0) + 1);
  }
  const tot = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`tandas simuladas: ${tandas}`);
  for (const k of ["context", "meaning", "listening", "match"]) {
    const a = antes.get(k) ?? 0, d = despues.get(k) ?? 0;
    console.log(`${k.padEnd(10)} antes ${String(a).padStart(3)} (${Math.round((a / tot(antes)) * 100)}%)   despues ${String(d).padStart(3)} (${Math.round((d / tot(despues)) * 100)}%)`);
  }
  await prisma.$disconnect();
}
main();
