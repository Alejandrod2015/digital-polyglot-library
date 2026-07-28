/**
 * Dump CatalogStoryAudioTimings payloads + audio for offline scoring.
 *   npx tsx scripts/_dumpCatalogTimings.ts <outDir> [--limit 3] [--slug a,b]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";

const prisma = new PrismaClient();

async function main() {
  const argv = process.argv.slice(2);
  const outDir = argv[0];
  const at = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const slugs = at("--slug")?.split(",").map((s) => s.trim());
  const limit = parseInt(at("--limit") ?? "3", 10);
  mkdirSync(outDir, { recursive: true });

  const stories = await prisma.catalogStory.findMany({
    where: { book: { published: true }, ...(slugs ? { slug: { in: slugs } } : {}) },
    select: {
      slug: true,
      audio: true,
      audioUrl: true,
      language: true,
      book: { select: { language: true } },
    },
    take: slugs ? slugs.length : limit,
  });

  for (const story of stories) {
    const row = await prisma.catalogStoryAudioTimings.findUnique({
      where: { slug: story.slug },
      select: { audioWordTimings: true },
    });
    const payload = coerceAudioWordTimings(row?.audioWordTimings);
    const audio = story.audioUrl || story.audio;
    if (!payload || !audio) {
      console.log(`skip ${story.slug}`);
      continue;
    }
    const res = await fetch(audio);
    if (!res.ok) {
      console.log(`skip ${story.slug}: audio ${res.status}`);
      continue;
    }
    writeFileSync(path.join(outDir, `${story.slug}.mp3`), Buffer.from(await res.arrayBuffer()));
    writeFileSync(
      path.join(outDir, `${story.slug}.json`),
      JSON.stringify(
        {
          slug: story.slug,
          language: story.language ?? story.book?.language ?? "spanish",
          audioUrl: audio,
          audioDurationSec: payload.audioDurationSec,
          storyPlainText: payload.storyPlainText,
          words: payload.words,
        },
        null,
        2
      )
    );
    console.log(`${story.slug}: ${payload.words.length} tokens`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
