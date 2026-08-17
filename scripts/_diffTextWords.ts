import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";

const p = new PrismaClient();

function words(s: string) {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Minimal LCS-based word diff, enough to show what actually changed.
function diff(a: string[], b: string[]) {
  const n = a.length,
    m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: string[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`-${a[i++]}`);
    else out.push(`+${b[j++]}`);
  }
  while (i < n) out.push(`-${a[i++]}`);
  while (j < m) out.push(`+${b[j++]}`);
  return out;
}

async function main() {
  const timings = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, updatedAt: true } });
  const tmap = new Map(timings.map((t) => [t.slug, t.updatedAt]));
  console.log(
    "timings rows generated:",
    [...new Set(timings.map((t) => t.updatedAt.toISOString().slice(0, 10)))].sort().join(", ")
  );

  for (const b of Object.values(books)) {
    const row = await p.catalogBook.findUnique({ where: { slug: b.slug }, include: { stories: true } });
    if (!row) continue;
    const byslug = new Map(row.stories.map((s) => [s.slug, s]));
    console.log(`\n#### ${b.slug}   (- = solo en DUMP, + = solo en DB)`);
    let shown = 0;
    for (const s of b.stories) {
      const r = byslug.get(s.slug);
      if (!r) continue;
      const d = diff(words(s.text), words(r.text));
      if (!d.length) continue;
      if (shown++ >= 4) continue;
      console.log(`  ${s.slug}  (timings: ${tmap.get(s.slug)?.toISOString().slice(0, 10) ?? "none"})`);
      console.log(`    ${d.slice(0, 30).join(" ")}`);
    }
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
