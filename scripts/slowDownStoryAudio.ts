/**
 * Stretch a story's existing audio without re-running TTS. Pulls the current
 * audioUrl from R2, runs ffmpeg's atempo filter (preserves pitch, slows the
 * waveform), uploads the result, updates the DB pointer.
 *
 * Trade-off vs. regenerating with a slower model speed: zero ElevenLabs cost,
 * but the result has a faintly stretched quality vs. natural slower speech.
 *
 * Usage: --slug=<slug> --tempo=0.95 [--apply | --dry-run]
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

function arg(name: string, fallback?: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!found) return fallback;
  return found.split("=").slice(1).join("=");
}

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function ffmpegSlow(inputPath: string, outputPath: string, tempo: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // atempo accepts 0.5-2.0 in a single pass. 0.95 = 5% slower while keeping
    // pitch. loudnorm afterward keeps -16 LUFS so the slowed file matches the
    // rest of the catalog.
    const filter = `atempo=${tempo},loudnorm=I=-16:LRA=11:TP=-1.5`;
    const proc = spawn("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", inputPath,
      "-af", filter,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      outputPath,
    ]);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`)));
  });
}

async function run() {
  const slug = arg("slug");
  const tempo = parseFloat(arg("tempo", "0.95")!);
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!slug) { console.error("Pass --slug=<story-slug>"); process.exit(1); }
  if (!apply && !dryRun) { console.error("Pass --apply or --dry-run"); process.exit(1); }
  if (!Number.isFinite(tempo) || tempo < 0.5 || tempo > 2.0) {
    console.error("--tempo must be a number between 0.5 and 2.0");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const dir = mkdtempSync(path.join(tmpdir(), "slow-"));
  try {
    const story = await prisma.journeyStory.findFirst({ where: { slug } });
    if (!story?.audioUrl) { console.error(`${slug}: no audioUrl`); process.exit(1); }
    console.log(`${slug}`);
    console.log(`  current: ${story.audioUrl}`);

    const inPath = path.join(dir, "in.mp3");
    const outPath = path.join(dir, "out.mp3");
    const buf = await downloadToBuffer(story.audioUrl);
    writeFileSync(inPath, buf);

    if (!apply) {
      console.log(`  [dry-run] downloaded ${buf.length} bytes; would slow to atempo=${tempo}`);
      return;
    }

    await ffmpegSlow(inPath, outPath, tempo);
    const processed = readFileSync(outPath);
    const baseName = (story.audioFilename ?? `${slug}.mp3`).replace(/\.mp3$/, "").replace(/_atempo[\d.]+_\d+$/, "");
    const newName = `${baseName}_atempo${tempo}_${Date.now()}.mp3`;
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${newName}`,
      body: processed,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) { console.error("upload failed"); return; }
    console.log(`  new:     ${uploaded.url}`);

    await prisma.journeyStory.update({
      where: { id: story.id },
      data: { audioUrl: uploaded.url, audioFilename: newName, audioStatus: "ready" },
    });
    console.log(`  DB updated (atempo=${tempo})`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
