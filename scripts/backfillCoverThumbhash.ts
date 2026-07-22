import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { computeCoverThumbhash } from "../src/lib/coverThumbhash";

const prisma = new PrismaClient();
const CONCURRENCY = 8;

async function mapPool<T>(items: T[], fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]!);
      }
    })
  );
}

async function backfillModel(
  name: string,
  rows: { id: string; coverUrl: string | null }[],
  update: (id: string, hash: string) => Promise<unknown>
) {
  const todo = rows.filter((r) => r.coverUrl);
  let ok = 0,
    fail = 0;
  console.log(`\n[${name}] ${todo.length} covers sin thumbhash`);
  await mapPool(todo, async (row) => {
    const hash = await computeCoverThumbhash(row.coverUrl!);
    if (hash) {
      await update(row.id, hash);
      ok++;
    } else {
      fail++;
      console.log(`  [${name}] fallo: ${row.id} ${row.coverUrl?.slice(0, 70)}`);
    }
    if ((ok + fail) % 25 === 0) console.log(`  [${name}] ${ok + fail}/${todo.length}`);
  });
  console.log(`[${name}] LISTO: ${ok} ok, ${fail} fallos`);
}

async function main() {
  const standalone = await prisma.standaloneStory.findMany({
    where: { coverUrl: { not: null }, coverThumbhash: null },
    select: { id: true, coverUrl: true },
  });
  await backfillModel("StandaloneStory", standalone, (id, hash) =>
    prisma.standaloneStory.update({ where: { id }, data: { coverThumbhash: hash } })
  );

  const journey = await prisma.journeyStory.findMany({
    where: { coverUrl: { not: null }, coverThumbhash: null },
    select: { id: true, coverUrl: true },
  });
  await backfillModel("JourneyStory", journey, (id, hash) =>
    prisma.journeyStory.update({ where: { id }, data: { coverThumbhash: hash } })
  );

  console.log("\n=== BACKFILL COMPLETO ===");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
