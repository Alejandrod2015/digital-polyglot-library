// Confirms the cdn.sanity.io -> R2 migration landed: counts how many rows
// have a R2 URL in coverUrl/audioUrl and shows what the reader will serve
// for each scope (using the same `*Url ?? *` fallback the helpers apply).

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const R2_PREFIX = "https://pub-";
const SANITY_PREFIX = "https://cdn.sanity.io/";

function classify(url: string | null | undefined): "r2" | "sanity" | "other" | "missing" {
  if (!url) return "missing";
  if (url.startsWith(R2_PREFIX)) return "r2";
  if (url.startsWith(SANITY_PREFIX)) return "sanity";
  return "other";
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const books = await prisma.catalogBook.findMany({
      select: { id: true, cover: true, coverUrl: true },
    });
    const stories = await prisma.catalogStory.findMany({
      select: { id: true, cover: true, coverUrl: true, audio: true, audioUrl: true },
    });
    const standalones = await prisma.standaloneStory.findMany({
      select: { id: true, published: true, cover: true, coverUrl: true, audio: true, audioUrl: true },
    });

    function summarize(label: string, items: Array<{ effective: string | null | undefined; original: string | null | undefined }>) {
      const counts = { r2: 0, sanity: 0, other: 0, missing: 0 };
      for (const it of items) {
        counts[classify(it.effective)]++;
      }
      console.log(`  ${label}: total=${items.length}  served=${JSON.stringify(counts)}`);
    }

    console.log("=== Effective URL served by reader (coverUrl ?? cover, audioUrl ?? audio) ===\n");

    console.log("CatalogBook covers");
    summarize("books", books.map((b) => ({ effective: b.coverUrl ?? b.cover, original: b.cover })));

    console.log("\nCatalogStory covers");
    summarize("stories.cover", stories.map((s) => ({ effective: s.coverUrl ?? s.cover, original: s.cover })));
    console.log("CatalogStory audios");
    summarize("stories.audio", stories.map((s) => ({ effective: s.audioUrl ?? s.audio, original: s.audio })));

    const publishedStandalones = standalones.filter((s) => s.published);
    console.log("\nStandaloneStory (PUBLISHED) covers");
    summarize("standalone.cover", publishedStandalones.map((s) => ({ effective: s.coverUrl ?? s.cover, original: s.cover })));
    console.log("StandaloneStory (PUBLISHED) audios");
    summarize("standalone.audio", publishedStandalones.map((s) => ({ effective: s.audioUrl ?? s.audio, original: s.audio })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
