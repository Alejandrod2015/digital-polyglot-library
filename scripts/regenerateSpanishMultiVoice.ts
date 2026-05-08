/**
 * Regenera el audio de stories español multi-voz aplicando el fix de
 * phantom-syllable (commit 8a79a4d). Replica lo que hace
 * `/api/studio/audio/generate-local` pero saltando la auth de Clerk
 * (corre como script local con DB + R2 + Modal env vars del .env.local).
 *
 * Pipeline por story:
 *   1. Lee dialogueSpec, title, language, ambientTag de DB.
 *   2. Escribe spec.json a temp dir.
 *   3. Spawnea Python TTS con --spec, --lang, --postprocess, --ambient.
 *   4. Lee el MP3 de salida.
 *   5. Pasa por `trimAudioBoundariesByAlignment` (aeneas via Modal +
 *      ffmpeg splice por límites de oración).
 *   6. Sube a R2 con filename fresh (timestamp).
 *   7. Update story.audioUrl + audioFilename + audioStatus="ready".
 *
 * Uso:
 *   npx tsx scripts/regenerateSpanishMultiVoice.ts --slug=carnitas-en-coyoacan
 *   npx tsx scripts/regenerateSpanishMultiVoice.ts --all  # ambas
 */

import { config } from "dotenv";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { trimAudioBoundariesByAlignment } from "../src/lib/audioBoundaryTrim";

const TARGET_SLUGS_DEFAULT = ["carnitas-en-coyoacan", "tinto-en-la-candelaria"];

const LANGUAGE_TO_KOKORO: Record<string, string> = {
  english: "en",
  spanish: "es",
  french: "fr",
  italian: "it",
  portuguese: "pt",
};

function projectRoot(): string {
  // Asumimos que el script corre desde la raíz del repo principal.
  return process.cwd();
}

function pythonBinary(): string {
  return join(projectRoot(), "scripts", "tts", ".venv", "bin", "python");
}

function ttsScript(): string {
  return join(projectRoot(), "scripts", "tts", "generate_audio.py");
}

function ambientPath(tag: string | null, language: string): string | null {
  if (!tag) return null;
  const langSuffix: Record<string, string> = {
    spanish: "es", german: "de", english: "en",
    french: "fr", italian: "it", portuguese: "pt",
  }[language.toLowerCase()] ?? null;
  const dir = join(projectRoot(), "scripts", "tts", "ambience");
  if (langSuffix) {
    const localized = join(dir, `${tag}_${langSuffix}.mp3`);
    if (existsSync(localized)) return localized;
  }
  const generic = join(dir, `${tag}.mp3`);
  return existsSync(generic) ? generic : null;
}

function filenameFromTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

async function runPythonTTS(args: {
  specPath: string;
  lang: string;
  outputPath: string;
  ambientPath: string | null;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const argv = [ttsScript(), "--lang", args.lang, "--postprocess", "-o", args.outputPath, "--spec", args.specPath];
    if (args.ambientPath) argv.push("--ambient", args.ambientPath);
    const child = spawn(pythonBinary(), argv, { stdio: ["ignore", "pipe", "pipe"], cwd: projectRoot() });
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => process.stdout.write(`[tts] ${chunk}`));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", (err) => reject(new Error(`Python spawn failed: ${err.message}`)));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      const stderr = Buffer.concat(stderrChunks).toString();
      reject(new Error(`Python exit ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

function buildPlainText(title: string, dialogueSpec: Array<{ text: string }>): string {
  const titleClean = title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const segs = dialogueSpec
    .map((s) => (typeof s.text === "string" ? s.text.trim() : ""))
    .filter(Boolean);
  return [titleClean, ...segs].filter(Boolean).join(" ");
}

async function regenerateOne(prisma: PrismaClient, slug: string): Promise<void> {
  console.log(`\n=== ${slug} ===`);
  const story = await prisma.journeyStory.findFirst({
    where: { slug: { equals: slug, mode: "insensitive" } },
    include: { journey: true },
  });
  if (!story) throw new Error(`story ${slug} not found`);
  if (!story.text || !story.title) throw new Error(`story ${slug} missing text/title`);
  if (!Array.isArray(story.dialogueSpec) || (story.dialogueSpec as unknown[]).length === 0) {
    throw new Error(`story ${slug} has no dialogueSpec`);
  }

  const langKey = story.journey.language.toLowerCase();
  const kokoroLang = LANGUAGE_TO_KOKORO[langKey] ?? "es";
  const ambient = ambientPath(story.ambientTag, story.journey.language);
  const spec = (story.dialogueSpec as Array<{ voice: string; text: string }>).map((s) => ({
    voice: s.voice,
    text: s.text,
  }));

  console.log(`  ${spec.length} segmentos, lang=${kokoroLang}, ambient=${ambient ? "sí" : "no"}`);

  const tempDir = await mkdtemp(join(tmpdir(), "regen-"));
  const filename = `${filenameFromTitle(story.title)}_${Date.now()}.mp3`;
  const tempFile = join(tempDir, filename);
  const specPath = join(tempDir, "spec.json");

  try {
    await writeFile(specPath, JSON.stringify(spec));
    console.log(`  spawning Python TTS (este paso es el más largo)...`);
    await runPythonTTS({
      specPath,
      lang: kokoroLang,
      outputPath: tempFile,
      ambientPath: ambient,
    });
    console.log(`  Python OK, leyendo buffer...`);
    const rawBuffer = await readFile(tempFile);
    console.log(`  raw buffer = ${(rawBuffer.length / 1024).toFixed(1)} KB`);

    const plainText = buildPlainText(story.title, spec);
    console.log(`  llamando aeneas align (${plainText.length} chars de texto)...`);
    const cleaned = await trimAudioBoundariesByAlignment({
      audioBuffer: rawBuffer,
      plainText,
      language: story.journey.language,
    });
    const finalBuffer = cleaned ?? rawBuffer;
    console.log(`  ${cleaned ? "trim aplicado" : "trim falló — uso raw buffer"}, final = ${(finalBuffer.length / 1024).toFixed(1)} KB`);

    console.log(`  subiendo a R2...`);
    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${filename}`,
      body: finalBuffer,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) throw new Error("R2 upload failed");
    console.log(`  ✓ ${uploaded.url}`);

    await prisma.journeyStory.update({
      where: { id: story.id },
      data: {
        audioUrl: uploaded.url,
        audioFilename: filename,
        audioSegments: [],
        audioStatus: "ready",
        audioQaStatus: null,
        audioQaScore: null,
        audioQaNotes: null,
      },
    });
    console.log(`  ✓ DB updated`);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const slugArg = args.find((a) => a.startsWith("--slug="));
  const all = args.includes("--all");
  const slugs = slugArg ? [slugArg.split("=")[1]] : (all ? TARGET_SLUGS_DEFAULT : []);
  if (slugs.length === 0) {
    console.error("Pasar --slug=<slug> o --all");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    for (const slug of slugs) {
      await regenerateOne(prisma, slug);
    }
    console.log("\n✓ Todos los regen completados");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
