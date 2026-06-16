/**
 * Mix a looped ambient track into existing dialogue audio for the 3
 * multi-voice journey stories. No new TTS calls.
 *
 * Pipeline:
 *   1. Download story audio from R2.
 *   2. ffmpeg amix the dialogue + ambient (15% volume, looped, fades) and
 *      run loudnorm to bring the final mix back to -16 LUFS.
 *   3. Upload the resulting MP3 to R2 with a `_ambient_<ts>.mp3` suffix.
 *   4. Update audioUrl, audioFilename, and ambientTag on the DB row.
 */

import { config } from "dotenv";
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { computeNarratorOffIntervals, buildAmbientStage } from "../src/lib/narrationPostProcess";

config({ path: ".env.local" });
config({ path: ".env" });

type Mapping = { slug: string; ambientTag: string; ambientFile: string };

const ROOT = path.resolve(__dirname, "..");
const AMBIENT_DIR = path.join(ROOT, "scripts", "tts", "ambience");

const MAPPINGS: Mapping[] = [
  { slug: "cafe-in-kreuzberg", ambientTag: "cafeteria", ambientFile: path.join(AMBIENT_DIR, "cafeteria_de.mp3") },
  { slug: "beim-baecker-am-hackeschen-markt", ambientTag: "cafeteria", ambientFile: path.join(AMBIENT_DIR, "cafeteria_de.mp3") },
  { slug: "tomaten-vom-wochenmarkt", ambientTag: "mercado", ambientFile: path.join(AMBIENT_DIR, "mercado_de.mp3") },
];

async function downloadToBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function ffmpegMixAmbient(
  dialoguePath: string,
  ambientPath: string,
  outPath: string,
  offIntervals: [number, number][] = [],
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 1. ambient looped indefinitely (-stream_loop -1).
    // 2. ambient at 10%, silenced under the narrator (offIntervals) — the bed
    //    belongs to the scene, never the VO (feedback_ambient_not_under_narrator).
    // 3. amix takes both inputs; duration=first cuts to dialogue length.
    // 4. loudnorm normalizes the final mix to -16 LUFS.
    const ambientStage = buildAmbientStage({
      inLabel: "1:a",
      outLabel: "a1",
      volume: 0.1,
      offIntervals,
      scale: 1, // intervals already in the dialogue timeline
    });
    const filter =
      `${ambientStage};` +
      "[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];" +
      "[mix]loudnorm=I=-16:LRA=11:TP=-1.5";
    const proc = spawn("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-i", dialoguePath,
      "-stream_loop", "-1",
      "-i", ambientPath,
      "-filter_complex", filter,
      "-codec:a", "libmp3lame",
      "-b:a", "128k",
      outPath,
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
  if (!apply && !dryRun) { console.error("Pass --apply or --dry-run."); process.exit(1); }

  for (const m of MAPPINGS) {
    if (!existsSync(m.ambientFile)) {
      console.error(`Missing ambient file: ${m.ambientFile}`);
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  const dir = mkdtempSync(path.join(tmpdir(), "amb-"));
  try {
    for (const m of MAPPINGS) {
      const story = await prisma.journeyStory.findFirst({ where: { slug: m.slug } });
      if (!story?.audioUrl) { console.warn(`${m.slug}: no audioUrl`); continue; }
      console.log(`\n${m.slug}  (ambient=${m.ambientTag})`);
      console.log(`  current: ${story.audioUrl}`);

      // If a previous run already mixed an ambient track in, strip the
      // `_ambient_<ts>` suffix and pull the pre-ambient version from R2.
      // Otherwise stacking ambient layers compounds their volume.
      const preAmbientUrl = story.audioUrl.replace(/_ambient_\d+\.mp3$/, ".mp3");
      const sourceUrl = preAmbientUrl !== story.audioUrl ? preAmbientUrl : story.audioUrl;
      if (sourceUrl !== story.audioUrl) {
        console.log(`  source : ${sourceUrl}  (pre-ambient version)`);
      }

      const inPath = path.join(dir, `${m.slug}.in.mp3`);
      const outPath = path.join(dir, `${m.slug}.out.mp3`);
      const buf = await downloadToBuffer(sourceUrl);
      writeFileSync(inPath, buf);

      if (!apply) {
        console.log(`  [dry-run] downloaded ${buf.length} bytes; would mix and upload`);
        continue;
      }

      // Narrator ranges scaled to this dialogue file's actual duration.
      const { intervals, span } = computeNarratorOffIntervals(story.text ?? "", story.audioSegments);
      const dur = parseFloat(
        spawnSync("ffprobe", [
          "-v", "error", "-show_entries", "format=duration",
          "-of", "default=nw=1:nk=1", inPath,
        ]).stdout.toString().trim(),
      );
      const scale = span > 0 && Number.isFinite(dur) ? dur / span : 0;
      const scaledOff: [number, number][] = scale > 0
        ? intervals.map(([a, b]) => [a * scale, b * scale])
        : [];
      await ffmpegMixAmbient(inPath, m.ambientFile, outPath, scaledOff);
      const processed = readFileSync(outPath);
      const baseName = (story.audioFilename ?? `${m.slug}.mp3`).replace(/\.mp3$/, "");
      const newName = `${baseName.replace(/_ambient_\d+$/, "")}_ambient_${Date.now()}.mp3`;
      const uploaded = await uploadPublicObject({
        key: `media/generated/audio/${newName}`,
        body: processed,
        contentType: "audio/mpeg",
      });
      if (!uploaded?.url) { console.warn("  upload failed"); continue; }
      console.log(`  new:     ${uploaded.url}`);

      await prisma.journeyStory.update({
        where: { id: story.id },
        data: {
          audioUrl: uploaded.url,
          audioFilename: newName,
          audioStatus: "ready",
          ambientTag: m.ambientTag,
        },
      });
      console.log(`  DB updated (ambientTag=${m.ambientTag})`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
