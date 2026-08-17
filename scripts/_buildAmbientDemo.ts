/*
 * PROTOTYPE (exp/ambient-layer). Read-only on DB + local ffmpeg only.
 * Builds the artifacts for the playback-time ambient mixing demo:
 *   1. Concatenates the 24 DRY fragment takes of `se-fue-la-luz` (with the
 *      same 0.45s inter-section gap the editor uses) into a DRY voice master.
 *      This is EXACTLY what the audio editor produces today after any
 *      regenerate/cut/upload; no ambient. Proves: editing yields dry voice.
 *   2. Emits narrator-off intervals in THAT concat's timeline (a fragment is
 *      narrator VO → bed silenced there; characters → bed plays).
 *   3. Copies the rain ambient bed.
 * Outputs to public/_ambient-demo/ so the running :3000 dev server serves them.
 * Writes nothing to R2, prod DB, or any deployable route.
 */
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const prisma = new PrismaClient();
const GAP_SEC = 0.45;
const OUT_DIR = join(process.cwd(), "public", "_ambient-demo");
const AMBIENT_SRC = join(process.cwd(), "scripts", "tts", "ambience", "lluvia_es.mp3");

function ff(args: string[]) {
  const r = spawnSync("ffmpeg", args);
  if (r.status !== 0) throw new Error("ffmpeg: " + (r.stderr?.toString().slice(0, 300) ?? r.status));
}
function probeDur(path: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
  return parseFloat((r.stdout?.toString() ?? "0").trim()) || 0;
}
async function dl(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "se-fue-la-luz" },
    select: { audioFragments: true, text: true },
  });
  const frags = (story?.audioFragments as any[]) ?? [];
  if (!frags.length) throw new Error("no fragments");

  const tmp = join(tmpdir(), `ambdemo-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // silence gap clip
  const sil = join(tmp, "sil.mp3");
  ff(["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(GAP_SEC), "-c:a", "libmp3lame", "-b:a", "128k", sil]);

  // download + normalize each fragment to canonical, compute concat-timeline ranges
  const lines: string[] = [];
  const intervals: { start: number; end: number; speaker: string; narrator: boolean; text: string }[] = [];
  let cursor = 0;
  for (let i = 0; i < frags.length; i++) {
    const f = frags[i];
    const raw = join(tmp, `r${i}.mp3`);
    const seg = join(tmp, `s${i}.mp3`);
    writeFileSync(raw, await dl(f.url));
    ff(["-y", "-loglevel", "error", "-i", raw, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", seg]);
    const d = probeDur(seg);
    const speaker = (f.speaker ?? "narrator").toString();
    const isNarr = speaker.toLowerCase() === "narrator";
    intervals.push({ start: +cursor.toFixed(3), end: +(cursor + d).toFixed(3), speaker, narrator: isNarr, text: (f.text ?? "").slice(0, 60) });
    cursor += d;
    lines.push(`file '${seg.replace(/'/g, "'\\''")}'`);
    if (i < frags.length - 1) { lines.push(`file '${sil}'`); cursor += GAP_SEC; }
  }

  const listPath = join(tmp, "list.txt");
  writeFileSync(listPath, lines.join("\n"));
  const dryOut = join(OUT_DIR, "voice-dry.mp3");
  ff(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", dryOut]);

  copyFileSync(AMBIENT_SRC, join(OUT_DIR, "ambient.mp3"));
  writeFileSync(join(OUT_DIR, "intervals.json"), JSON.stringify({
    totalDurationSec: +cursor.toFixed(3),
    ambientVolume: 0.10,
    intervals,
  }, null, 2));

  const dryDur = probeDur(dryOut);
  console.log(`OK  dry master: ${dryDur.toFixed(2)}s, ${frags.length} fragments`);
  console.log(`    narrator ranges (bed muted): ${intervals.filter((x) => x.narrator).length}`);
  console.log(`    dialogue ranges (bed plays):  ${intervals.filter((x) => !x.narrator).length}`);
  console.log(`    -> public/_ambient-demo/{voice-dry.mp3, ambient.mp3, intervals.json}`);
  rmSync(tmp, { recursive: true, force: true });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
