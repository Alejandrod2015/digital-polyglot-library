/**
 * Dump stored karaoke word timings + audio for offline analysis (read-only).
 *   npx tsx scripts/_dumpTimings.ts <outDir> [--limit 10] [--lang spanish] [--slug s1,s2]
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
  if (!outDir) throw new Error("usage: _dumpTimings.ts <outDir> [--limit N] [--lang L] [--slug a,b]");
  const getArg = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = parseInt(getArg("--limit") ?? "10", 10);
  const lang = getArg("--lang");
  const slugs = getArg("--slug")?.split(",").map((s) => s.trim());

  mkdirSync(outDir, { recursive: true });

  const rows = await prisma.journeyStory.findMany({
    where: {
      audioUrl: { not: null },
      audioWordTimings: { not: null },
      ...(slugs ? { slug: { in: slugs } } : {}),
      ...(lang ? { journey: { language: lang } } : {}),
    },
    select: {
      slug: true,
      audioUrl: true,
      audioWordTimings: true,
      level: true,
      journey: { select: { language: true, variant: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: slugs ? slugs.length : limit,
  });

  for (const row of rows) {
    const payload = coerceAudioWordTimings(row.audioWordTimings);
    if (!payload || !row.audioUrl) continue;
    const mp3 = path.join(outDir, `${row.slug}.mp3`);
    const res = await fetch(row.audioUrl);
    if (!res.ok) {
      console.log(`skip ${row.slug}: audio ${res.status}`);
      continue;
    }
    writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
    writeFileSync(
      path.join(outDir, `${row.slug}.json`),
      JSON.stringify(
        {
          slug: row.slug,
          language: row.journey.language,
          variant: row.journey.variant,
          level: row.level,
          audioUrl: row.audioUrl,
          audioDurationSec: payload.audioDurationSec,
          storyPlainText: payload.storyPlainText,
          words: payload.words,
        },
        null,
        2
      )
    );
    console.log(`${row.slug} (${payload.words.length} tokens) -> ${outDir}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
