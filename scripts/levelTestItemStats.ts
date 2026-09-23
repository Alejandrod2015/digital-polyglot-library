/**
 * Pass rate per level-test item, from the `onboarding_level_test_completed`
 * events the app sends (`metadata.items`, one entry per exercise answered,
 * 2026-09-20). This is how the bank gets calibrated: an item almost everyone
 * gets right measures nothing, one almost nobody gets right measures the
 * wrong rung; both get replaced in `src/lib/levelTest/bank.es.ts`.
 *
 *   npx tsx scripts/levelTestItemStats.ts [--language=Spanish] [--min=5]
 *
 * `--min` hides items with fewer answers than that (default 5): below it the
 * rate is noise.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

type Item = { id: string; level: string; correct: boolean; timedOut: boolean; ms: number | null };

const prisma = new PrismaClient();

async function main() {
  const language = process.argv.find((a) => a.startsWith("--language="))?.slice(11) ?? "Spanish";
  const min = Number(process.argv.find((a) => a.startsWith("--min="))?.slice(6) ?? "5");
  const events = await prisma.userMetric.findMany({
    where: { eventType: "onboarding_level_test_completed" },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const agg = new Map<string, { level: string; n: number; right: number; timedOut: number; ms: number[] }>();
  let tests = 0;
  for (const e of events) {
    const meta = (e.metadata ?? {}) as { language?: string; items?: Item[] };
    if ((meta.language ?? "") !== language || !Array.isArray(meta.items)) continue;
    tests++;
    for (const it of meta.items) {
      const row = agg.get(it.id) ?? { level: it.level, n: 0, right: 0, timedOut: 0, ms: [] };
      row.n++;
      if (it.correct) row.right++;
      if (it.timedOut) row.timedOut++;
      if (typeof it.ms === "number") row.ms.push(it.ms);
      agg.set(it.id, row);
    }
  }
  console.log(`${language}: ${tests} tests with per-item data\n`);
  console.log("| rung | item | answered | right | timed out | median s | flag |");
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  const rows = [...agg.entries()].sort((a, b) => a[1].level.localeCompare(b[1].level) || a[0].localeCompare(b[0]));
  for (const [id, r] of rows) {
    if (r.n < min) continue;
    const rate = r.right / r.n;
    const med = r.ms.length ? (r.ms.sort((x, y) => x - y)[Math.floor(r.ms.length / 2)] / 1000).toFixed(1) : "-";
    const flag = rate >= 0.95 ? "too easy" : rate <= 0.2 ? "too hard" : r.timedOut / r.n >= 0.3 ? "slow" : "";
    console.log(`| ${r.level} | ${id} | ${r.n} | ${Math.round(rate * 100)}% | ${r.timedOut} | ${med} | ${flag} |`);
  }
  if (rows.every(([, r]) => r.n < min)) console.log(`(no item has ${min}+ answers yet)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
