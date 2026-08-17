import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function head(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return { status: r.status, len: Number(r.headers.get("content-length") ?? 0), type: r.headers.get("content-type") ?? "" };
  } catch (e) {
    return { status: -1, len: 0, type: String(e) };
  }
}

async function main() {
  const books = await p.catalogBook.findMany({
    where: { published: true },
    orderBy: { slug: "asc" },
    include: { stories: { orderBy: { position: "asc" } } },
  });

  const jobs: { book: string; slug: string; kind: string; url: string }[] = [];
  for (const b of books) {
    if (b.coverUrl) jobs.push({ book: b.slug, slug: "(book cover)", kind: "cover", url: b.coverUrl });
    for (const s of b.stories) {
      const a = s.audioUrl ?? s.audio;
      if (a) jobs.push({ book: b.slug, slug: s.slug, kind: "audio", url: a });
      const c = s.coverUrl ?? s.cover;
      if (c && c.startsWith("http")) jobs.push({ book: b.slug, slug: s.slug, kind: "cover", url: c });
    }
  }

  console.log(`checking ${jobs.length} urls...`);
  const bad: string[] = [];
  const sizes: number[] = [];
  const CONC = 12;
  for (let i = 0; i < jobs.length; i += CONC) {
    const batch = jobs.slice(i, i + CONC);
    const res = await Promise.all(batch.map((j) => head(j.url)));
    res.forEach((r, k) => {
      const j = batch[k];
      if (r.status !== 200) bad.push(`${r.status} ${j.book}/${j.slug} [${j.kind}] ${j.url}`);
      else if (j.kind === "audio") {
        sizes.push(r.len);
        if (r.len < 200_000) bad.push(`TINY(${r.len}B) ${j.book}/${j.slug} [audio] ${j.url}`);
      }
    });
  }

  console.log("\n=== NON-200 / SUSPICIOUS ===");
  console.log(bad.length ? bad.join("\n") : "  none");
  sizes.sort((a, b) => a - b);
  console.log(
    `\naudio sizes (n=${sizes.length}): min=${(sizes[0] / 1e6).toFixed(2)}MB p50=${(sizes[Math.floor(sizes.length / 2)] / 1e6).toFixed(2)}MB max=${(sizes[sizes.length - 1] / 1e6).toFixed(2)}MB`
  );

  // duplicate audio urls (same file reused by two stories)
  const byUrl = new Map<string, string[]>();
  for (const j of jobs.filter((x) => x.kind === "audio")) byUrl.set(j.url, [...(byUrl.get(j.url) ?? []), `${j.book}/${j.slug}`]);
  console.log("\n=== DUPLICATE AUDIO FILES ===");
  let dup = 0;
  for (const [u, arr] of byUrl) if (arr.length > 1) { dup++; console.log(`  ${arr.join("  ==  ")}\n    ${u}`); }
  if (!dup) console.log("  none");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
