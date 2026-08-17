import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const SLUG = process.argv[2] ?? "short-stories-in-mexican-spanish";

async function main() {
  const book = await prisma.catalogBook.findUnique({ where: { slug: SLUG } });
  if (!book) {
    console.log("❌ NO existe CatalogBook con slug", SLUG);
  } else {
    const { ...b } = book as Record<string, unknown>;
    console.log("=== CatalogBook ===");
    for (const [k, v] of Object.entries(b)) {
      const s = typeof v === "string" && v.length > 120 ? v.slice(0, 120) + "…" : v;
      console.log(` ${k}:`, s);
    }
  }

  const stories = await prisma.catalogStory.findMany({
    where: { bookId: book?.id ?? SLUG },
    orderBy: { position: "asc" },
  });
  console.log(`\n=== CatalogStory (${stories.length}) ===`);
  for (const s of stories as unknown as Record<string, unknown>[]) {
    console.log(
      JSON.stringify({
        position: s.position,
        slug: s.slug,
        title: s.title,
        audioUrl: s.audioUrl ? String(s.audioUrl).slice(-60) : null,
        hasText: typeof s.text === "string" ? (s.text as string).length : null,
        vocab: Array.isArray(s.vocab) ? (s.vocab as unknown[]).length : null,
      })
    );
  }

  const timings = await prisma.catalogStoryAudioTimings.count({
    where: { slug: { in: stories.map((s) => s.slug) } },
  });
  console.log(`\nTimings (karaoke) rows: ${timings} / ${stories.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
