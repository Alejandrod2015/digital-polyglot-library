import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config as loadEnv } from "dotenv";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import { getStandaloneStoryAudioSegments } from "@/lib/standaloneStoryAudioSegments";

const execFileAsync = promisify(execFile);

loadEnv({ path: ".env.local" });
loadEnv();

function sanitizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function downloadFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download source audio: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
}

async function generateClip(sourcePath: string, destinationPath: string, startSec: number, durationSec: number) {
  await execFileAsync("/usr/bin/avconvert", [
    "--source",
    sourcePath,
    "--output",
    destinationPath,
    "--preset",
    "PresetAppleM4A",
    "--replace",
    "--start",
    startSec.toFixed(3),
    "--duration",
    durationSec.toFixed(3),
  ]);
}

async function main() {
  const slugArg = process.argv[2];
  const slug = sanitizeSlug(slugArg || "");
  if (!slug) {
    throw new Error("Usage: npx tsx scripts/generateStandaloneStoryClips.ts <standalone-story-slug>");
  }

  const story = await getStandaloneStoryBySlug(slug);
  if (!story?.audioUrl) {
    throw new Error(`No published standalone story with audio found for slug "${slug}"`);
  }

  const segments = getStandaloneStoryAudioSegments(slug);
  if (segments.length === 0) {
    throw new Error(`No standalone audio segments configured for slug "${slug}"`);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dp-standalone-clips-"));
  const sourcePath = path.join(tempDir, `${slug}.mp3`);
  await downloadFile(story.audioUrl, sourcePath);

  const outputDir = path.join(process.cwd(), "public", "story-clips", slug);
  await ensureDir(outputDir);

  for (const segment of segments) {
    const durationSec = Math.max(0.12, segment.endSec - segment.startSec);
    const destinationPath = path.join(outputDir, `${segment.id}.m4a`);
    await generateClip(sourcePath, destinationPath, segment.startSec, durationSec);
    process.stdout.write(`Generated ${segment.id}\n`);
  }

  await fs.rm(tempDir, { recursive: true, force: true });
  process.stdout.write(`Done: ${outputDir}\n`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
