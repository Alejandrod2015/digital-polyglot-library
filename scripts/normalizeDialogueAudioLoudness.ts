/**
 * Post-process the multi-voice dialogue audio in R2 to equalize loudness across
 * speakers WITHOUT regenerating TTS.
 *
 * For each target story:
 *   1. Download the current audioUrl from DB.
 *   2. Run ffmpeg with dynaudnorm (per-segment dynamic normalization that
 *      smooths out loudness differences between speakers) followed by
 *      loudnorm (EBU R128 final pass at podcast target -16 LUFS).
 *   3. Upload the processed MP3 to R2 with a new filename.
 *   4. Update audioUrl + audioFilename in DB.
 *
 * No new ElevenLabs calls. No new charges to the TTS budget.
 */

import { config } from "dotenv";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawn } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

config({ path: ".env.local" });
config({ path: ".env" });

const TARGETS = [
  "cafe-in-kreuzberg",
  "beim-baecker-am-hackeschen-markt",
  "tomaten-vom-wochenmarkt",
];

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function ffmpegNormalize(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // dynaudnorm: per-window loudness compensation that smooths out volume
    //   jumps between speaker segments. g=5 sliding window, f=250ms frames,
    //   p=0.9 target peak, m=10dB max gain to avoid blowing up quiet noise.
    // loudnorm: final EBU R128 pass to a podcast-standard target.
    const filter =
      "dynaudnorm=g=5:f=250:p=0.9:m=10," +
      "loudnorm=I=-16:LRA=11:TP=-1.5";
    const proc = spawn("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-i", inputPath,
      "-af", filter,
      "-codec:a", "libmp3lame",
      "-b:a", "128k",
      outputPath,
    ]);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const dir = mkdtempSync(path.join(tmpdir(), "norm-"));
  try {
    for (const slug of TARGETS) {
      const story = await prisma.journeyStory.findFirst({ where: { slug } });
      if (!story || !story.audioUrl) { console.warn(`${slug}: no audioUrl`); continue; }
      console.log(`\n${slug}`);
      console.log(`  current: ${story.audioUrl}`);

      const inPath = path.join(dir, `${slug}.in.mp3`);
      const outPath = path.join(dir, `${slug}.out.mp3`);
      const buf = await downloadToBuffer(story.audioUrl);
      writeFileSync(inPath, buf);

      if (!apply) {
        console.log(`  [dry-run] downloaded ${buf.length} bytes; would normalize and upload`);
        continue;
      }

      await ffmpegNormalize(inPath, outPath);
      const processed = readFileSync(outPath);
      const baseName = (story.audioFilename ?? `${slug}.mp3`).replace(/\.mp3$/, "");
      const newName = `${baseName.replace(/_normalized_\d+$/, "")}_normalized_${Date.now()}.mp3`;
      const uploaded = await uploadPublicObject({
        key: `media/generated/audio/${newName}`,
        body: processed,
        contentType: "audio/mpeg",
      });
      if (!uploaded?.url) { console.warn(`  upload failed`); continue; }
      console.log(`  new:     ${uploaded.url}`);

      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { audioUrl: uploaded.url, audioFilename: newName, audioStatus: "ready" },
      });
      console.log(`  DB updated`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
