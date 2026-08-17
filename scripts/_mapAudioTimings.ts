import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

async function main() {
  const t = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioDurationSec: true } });
  const cs = await p.catalogStory.findMany({
    select: { slug: true, bookId: true, audioUrl: true, audio: true },
  });
  const books = await p.catalogBook.findMany({ select: { id: true, published: true } });
  const pub = new Map(books.map((b) => [b.id, b.published]));
  const set = new Set(t.map((x) => x.slug));
  console.log("CatalogStoryAudioTimings rows:", t.length);
  const missing = cs.filter((s) => !set.has(s.slug));
  console.log("catalog stories WITHOUT word timings:", missing.length, "/", cs.length);
  const byBook: Record<string, number> = {};
  for (const m of missing) byBook[`${m.bookId}${pub.get(m.bookId) ? "" : " (unpub)"}`] = (byBook[`${m.bookId}${pub.get(m.bookId) ? "" : " (unpub)"}`] || 0) + 1;
  console.log(byBook);

  // audio host distribution
  const hosts: Record<string, number> = {};
  for (const s of cs) {
    const url = s.audioUrl ?? s.audio ?? "";
    let h = "NONE";
    try {
      h = url ? new URL(url).host : "NONE";
    } catch {
      h = url ? `relative:${url.slice(0, 30)}` : "NONE";
    }
    hosts[h] = (hosts[h] || 0) + 1;
  }
  console.log("audio hosts:", hosts);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
