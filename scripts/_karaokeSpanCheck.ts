/**
 * Would the client-side 6% scaling patch still fire anywhere?
 *
 * It only engages when a payload's last endSec runs past the audio duration.
 * Before deleting it, check every stored payload (journey + catalog) for that
 * condition. Read-only.
 *
 *   npx tsx scripts/_karaokeSpanCheck.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";

const prisma = new PrismaClient();

function span(words: { startSec: number | null; endSec: number | null }[]): number {
  let max = 0;
  for (const w of words) {
    const end = typeof w.endSec === "number" ? w.endSec : w.startSec;
    if (typeof end === "number" && end > max) max = end;
  }
  return max;
}

async function main() {
  const offenders: string[] = [];
  let checked = 0;
  let noDuration = 0;
  let worst = -Infinity;
  let worstSlug = "";

  const journeys = await prisma.journeyStory.findMany({
    where: { audioWordTimings: { not: null } },
    select: { slug: true, audioWordTimings: true },
  });
  const catalog = await prisma.catalogStoryAudioTimings.findMany({
    select: { slug: true, audioWordTimings: true },
  });

  for (const [kind, rows] of [
    ["journey", journeys],
    ["catalog", catalog],
  ] as const) {
    for (const row of rows) {
      const payload = coerceAudioWordTimings(row.audioWordTimings);
      if (!payload) continue;
      const dur = payload.audioDurationSec;
      if (typeof dur !== "number" || dur <= 0) {
        noDuration += 1;
        continue;
      }
      checked += 1;
      const over = span(payload.words) - dur;
      if (over > worst) {
        worst = over;
        worstSlug = `${kind}/${row.slug}`;
      }
      // The patch engages on span > duration at all.
      if (over > 0) offenders.push(`${kind}/${row.slug} +${over.toFixed(3)}s`);
    }
  }

  console.log(`payloads con duración: ${checked} (sin duración: ${noDuration})`);
  console.log(`sobrepaso máximo: ${worst >= 0 ? "+" : ""}${worst.toFixed(3)}s en ${worstSlug}`);
  console.log(`payloads donde el parche del 6% aún se dispararía: ${offenders.length}`);
  for (const o of offenders.slice(0, 15)) console.log(`  ${o}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
