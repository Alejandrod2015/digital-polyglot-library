/**
 * Baja la VELOCIDAD de los clips de palabra suelta, sin re-sintetizar.
 *
 * ── El problema, medido ───────────────────────────────────────────────────
 *
 * `scripts/measureSpeechRate.ts` (2026-08-07, alemán) dio esto:
 *
 *     palabra suelta   5,04 síl/s
 *     habla corrida    4,26 síl/s   <- misma voz, mismo motor, sin quejas
 *
 * Las palabras van MÁS RÁPIDAS que la voz hablando seguido, y eso es al revés
 * de lo que debe ser: una palabra aislada, dicha para aprenderla, tiene que ir
 * más despacio que en una frase. Las peores llegaban a 6,35 síl/s.
 *
 * ── Por qué en el servidor y no con `rate` en el cliente ──────────────────
 *
 * Porque ya sabemos que estirar en el cliente sale mal. El 2026-05-19 un
 * rate 0,65 sobre clips mono de 22050 Hz convirtió una voz femenina en algo
 * "poseído y grave" en iOS (WSOLA de AVPlayer emborrona los formantes). La
 * conclusión de entonces sigue valiendo: si hay que ralentizar, se HORNEA con
 * ffmpeg y el cliente reproduce a rate 1,0.
 *
 * Y hay una razón de coste: esto NO llama a ElevenLabs. Coge el mp3 que ya
 * existe y lo re-encodea. Cero créditos. Re-sintetizar 150 palabras para
 * corregir un ritmo sería tirar el dinero.
 *
 * ── Cómo decide cuánto ralentizar cada una ────────────────────────────────
 *
 * NO aplica un factor fijo. Mide cada clip y calcula el suyo, porque el lote
 * va de 3,00 a 6,35 síl/s: un factor único dejaría las lentas arrastrándose y
 * las rápidas aún rápidas. Cada clip se lleva a TARGET síl/s, con el factor
 * limitado a [0,75, 1,0] para no estirar nada de forma extrema y para no
 * ACELERAR nunca una palabra que ya iba bien.
 *
 * `atempo` cambia el tempo SIN tocar el tono, así que la voz no se vuelve
 * grave: es exactamente lo que faltó en 2026-05-19.
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/slowWordClips.ts --lang german --dry     # tabla, sin tocar
 *   npx tsx scripts/slowWordClips.ts --lang german           # aplica
 *
 * Escribe en una clave R2 NUEVA (v5) y actualiza el payload; el mp3 anterior
 * sigue existiendo, así que volver atrás es restaurar la URL vieja.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

const prisma = new PrismaClient();

/** Sílabas por segundo a las que queda cada palabra. */
const TARGET_SYL_PER_SEC = 4.0;
/** Nunca acelerar (>=1.0 se descarta) ni estirar más allá de esto. */
const MIN_FACTOR = 0.75;

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function duration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number.parseFloat(stdout.trim()) || 0;
}

/** Igual que measureSpeechRate: habla real, sin el silencio de los extremos. */
async function speechSeconds(file: string, workDir: string): Promise<number> {
  const out = path.join(workDir, "trim.wav");
  const trim =
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01:detection=peak," +
    "areverse," +
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01:detection=peak," +
    "areverse";
  const res = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-af", trim, out]);
  if (res.code !== 0) return duration(file);
  return duration(out);
}

function countSyllables(text: string): number {
  const clean = text.toLowerCase().replace(/[^a-zäöüßáéíóúñàèìòùâêîôû\s]/g, " ");
  let total = 0;
  for (const word of clean.split(/\s+/).filter(Boolean)) {
    const merged = word.replace(/(au|äu|eu|ei|ai|ie)/g, "A").replace(/[aeiouäöüy]+/g, "A");
    total += Math.max(1, (merged.match(/A/g) ?? []).length);
  }
  return total;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (n: string) => {
    const hit = argv.find((a) => a.startsWith(`--${n}=`));
    if (hit) return hit.split("=")[1];
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dry = argv.includes("--dry");
  const language = (arg("lang") ?? "german").toLowerCase();

  const rows = await prisma.storyPracticeExercise.findMany({
    where: { set: { story: { journey: { language: { equals: language, mode: "insensitive" } } } } },
    select: { id: true, word: true, payload: true },
    take: 4000,
  });

  const targets = rows
    .map((r) => {
      const payload = r.payload as Record<string, unknown> | null;
      const clip = payload?.audioClip as Record<string, unknown> | undefined;
      const url = typeof clip?.wordClipUrl === "string" ? clip.wordClipUrl : null;
      return url && r.word ? { id: r.id, word: r.word, url, payload, clip } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  console.log(`${targets.length} clips de palabra en ${language}\n`);

  const workDir = mkdtempSync(path.join(tmpdir(), "slowword-"));
  let changed = 0;
  let skipped = 0;

  for (const t of targets) {
    const res = await fetch(t.url);
    if (!res.ok) {
      console.log(`  ${t.word.padEnd(30)} HTTP ${res.status}, saltada`);
      skipped++;
      continue;
    }
    const inPath = path.join(workDir, "in.mp3");
    writeFileSync(inPath, Buffer.from(await res.arrayBuffer()));

    const speech = await speechSeconds(inPath, workDir);
    const syl = countSyllables(t.word);
    if (speech <= 0.05) {
      console.log(`  ${t.word.padEnd(30)} sin habla detectable, saltada`);
      skipped++;
      continue;
    }
    const rate = syl / speech;
    const raw = TARGET_SYL_PER_SEC / rate;
    const factor = Math.max(MIN_FACTOR, Math.min(1, raw));

    if (factor >= 0.995) {
      console.log(`  ${t.word.padEnd(30)} ${rate.toFixed(2)} síl/s  ya va bien, se deja`);
      skipped++;
      continue;
    }

    const after = rate * factor;
    console.log(
      `  ${t.word.padEnd(30)} ${rate.toFixed(2)} -> ${after.toFixed(2)} síl/s   atempo ${factor.toFixed(3)}`
    );
    if (dry) {
      changed++;
      continue;
    }

    const outPath = path.join(workDir, "out.mp3");
    const enc = await run("ffmpeg", [
      "-y", "-loglevel", "error", "-i", inPath,
      // atempo NO toca el tono: la voz no se vuelve grave (el fallo de 2026-05-19).
      "-af", `atempo=${factor.toFixed(4)}`,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      outPath,
    ]);
    if (enc.code !== 0) {
      console.log(`    ffmpeg falló: ${enc.stderr.slice(0, 160)}`);
      skipped++;
      continue;
    }

    const key = `media/practice/word-clip/${crypto
      .createHash("sha256")
      .update(`w5slow|${TARGET_SYL_PER_SEC}|${t.url}`)
      .digest("hex")
      .slice(0, 20)}.mp3`;
    const uploaded = await uploadPublicObject({
      key,
      body: readFileSync(outPath),
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      console.log("    fallo al subir a R2");
      skipped++;
      continue;
    }

    const nextPayload = {
      ...(t.payload ?? {}),
      audioClip: {
        ...(t.clip ?? {}),
        wordClipUrl: uploaded.url,
        // Rastro para poder volver atrás sin adivinar.
        wordClipUrlBeforeSlowdown: t.clip?.wordClipUrlBeforeSlowdown ?? t.url,
        wordClipSpeechRate: Number(after.toFixed(2)),
      },
    };
    await prisma.storyPracticeExercise.update({
      where: { id: t.id },
      data: { payload: nextPayload as never },
    });
    changed++;
  }

  rmSync(workDir, { recursive: true, force: true });
  console.log(
    `\n${dry ? "[dry] " : ""}${changed} ralentizadas, ${skipped} sin tocar (objetivo ${TARGET_SYL_PER_SEC} síl/s)`
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
