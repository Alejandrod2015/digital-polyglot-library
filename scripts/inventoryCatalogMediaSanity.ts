// Counts how many media URLs in the Studio catalog tables still point at
// cdn.sanity.io (audio + images). Read-only.

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const SANITY_PREFIX = "https://cdn.sanity.io/";

function isSanity(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith(SANITY_PREFIX);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const catalogStories = await prisma.catalogStory.findMany({
      select: { id: true, slug: true, cover: true, coverUrl: true, audio: true },
    });
    const catalogBooks = await prisma.catalogBook.findMany({
      select: { id: true, slug: true, cover: true },
    });
    const standaloneStories = await prisma.standaloneStory.findMany({
      select: { id: true, slug: true, published: true, cover: true, coverUrl: true, audio: true, audioUrl: true },
    });

    let catalogStorySanityCover = 0;
    let catalogStorySanityAudio = 0;
    for (const s of catalogStories) {
      if (isSanity(s.cover) || isSanity(s.coverUrl)) catalogStorySanityCover++;
      if (isSanity(s.audio)) catalogStorySanityAudio++;
    }

    let catalogBookSanityCover = 0;
    for (const b of catalogBooks) {
      if (isSanity(b.cover)) catalogBookSanityCover++;
    }

    let standaloneSanityCover = 0;
    let standaloneSanityAudio = 0;
    let standalonePublishedSanityCover = 0;
    let standalonePublishedSanityAudio = 0;
    for (const s of standaloneStories) {
      const hasCoverSanity = isSanity(s.cover) || isSanity(s.coverUrl);
      const hasAudioSanity = isSanity(s.audio) || isSanity(s.audioUrl);
      if (hasCoverSanity) standaloneSanityCover++;
      if (hasAudioSanity) standaloneSanityAudio++;
      if (s.published) {
        if (hasCoverSanity) standalonePublishedSanityCover++;
        if (hasAudioSanity) standalonePublishedSanityAudio++;
      }
    }

    console.log("=== CatalogBook ===");
    console.log(`  Total: ${catalogBooks.length}`);
    console.log(`  Cover on cdn.sanity.io: ${catalogBookSanityCover}`);

    console.log("\n=== CatalogStory ===");
    console.log(`  Total: ${catalogStories.length}`);
    console.log(`  Cover on cdn.sanity.io: ${catalogStorySanityCover}`);
    console.log(`  Audio on cdn.sanity.io: ${catalogStorySanityAudio}`);

    console.log("\n=== StandaloneStory ===");
    console.log(`  Total: ${standaloneStories.length}`);
    console.log(`  Cover on cdn.sanity.io: ${standaloneSanityCover}`);
    console.log(`  Audio on cdn.sanity.io: ${standaloneSanityAudio}`);
    console.log(`  -- restricted to published == true --`);
    console.log(`  Cover on cdn.sanity.io: ${standalonePublishedSanityCover}`);
    console.log(`  Audio on cdn.sanity.io: ${standalonePublishedSanityAudio}`);

    const total =
      catalogBookSanityCover +
      catalogStorySanityCover +
      catalogStorySanityAudio +
      standaloneSanityCover +
      standaloneSanityAudio;
    console.log(`\nTotal URLs to migrate to R2: ${total}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
