/**
 * Level-match fragment [5] of "El mole poblano" (slug el-mole-poblano).
 *
 * WHY: the last section was rendered 5.4 dB quieter than the rest of the
 * master (-21.83 vs -16.43 LUFS, true peak -8.11 vs -5.18 dB), so the
 * closing 10 s of the story plays at roughly half the perceived loudness.
 * Reported by Fatima 2026-07-29 ("Min: 0:48 ... el audio baja de volumen").
 *
 * NO TTS. Pure gain on the existing master: +5.40 dB applied from 46.41 s
 * (the fragment-5 boundary), ramped inside the silence gap so there is no
 * click. Duration is byte-for-byte identical, so audioWordTimings and
 * audioSegments stay valid and no realignment is needed.
 *
 * Usage: npx tsx scripts/_levelMoleTail.ts <fixed.mp3> [--apply]
 * Without --apply it only reports what it would do.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

const SLUG = "el-mole-poblano";
const prisma = new PrismaClient();

async function main() {
  const src = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!src) throw new Error("usage: _levelMoleTail.ts <fixed.mp3> [--apply]");

  const story = await prisma.journeyStory.findFirst({
    where: { slug: SLUG },
    select: { id: true, title: true, audioUrl: true, audioFilename: true },
  });
  if (!story) throw new Error(`story ${SLUG} not found`);

  const body = readFileSync(src);
  const filename = `El_mole_poblano_multivoice_leveled_${Date.now()}.mp3`;
  const key = `media/generated/audio/${filename}`;

  console.log(`story    ${story.id} "${story.title}"`);
  console.log(`old url  ${story.audioUrl}`);
  console.log(`new key  ${key}  (${(body.length / 1024).toFixed(0)} KB)`);
  if (!apply) {
    console.log("\ndry run, nothing written. re-run with --apply");
    await prisma.$disconnect();
    return;
  }

  const up = await uploadPublicObject({ key, body, contentType: "audio/mpeg" });
  if (!up?.url) throw new Error("upload failed (object storage not configured?)");
  console.log(`uploaded ${up.url}`);

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: { audioUrl: up.url, audioFilename: filename },
  });
  console.log("db updated (audioUrl, audioFilename)");
  console.log(`\nrollback: set audioUrl back to\n  ${story.audioUrl}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
