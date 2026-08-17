/**
 * ¿A qué VELOCIDAD habla un clip? Medida factual, no impresión.
 *
 * ── Por qué existe ────────────────────────────────────────────────────────
 *
 * El usuario dijo que `die Wartezeit` sonaba demasiado rápida. Yo respondí que
 * no, apoyándome en la DURACIÓN del clip (0,98 s, "rango normal"). Eso no mide
 * velocidad: una palabra larga en un segundo va deprisa y una corta en un
 * segundo va despacio. La duración sola no dice nada sin saber cuánto hay que
 * pronunciar dentro.
 *
 * ── Qué se mide ───────────────────────────────────────────────────────────
 *
 * La TASA DE ARTICULACIÓN: sílabas por segundo de habla REAL, descontando el
 * silencio de los extremos. Es la medida estándar de velocidad del habla, y es
 * la única que permite comparar una palabra con una frase.
 *
 *   1. Se recorta el silencio de cabeza y cola (umbral -40 dB). Un clip lleva
 *      relleno al principio y 0,15 s de cola añadidos por el endpoint; contar
 *      eso como habla falsea la tasa hacia abajo, es decir, hace parecer LENTO
 *      lo que va rápido.
 *   2. Se cuentan sílabas por núcleos vocálicos, uniendo diptongos. En alemán
 *      la -e final SÍ se pronuncia (a diferencia del inglés), así que no se
 *      aplica ninguna regla de muda.
 *   3. tasa = sílabas / segundos de habla.
 *
 * También se da caracteres por segundo, que es la idea original del usuario:
 * más tosca porque el alemán acumula consonantes, pero útil como contraste.
 *
 * ── Contra qué se compara ─────────────────────────────────────────────────
 *
 * Contra el propio proyecto, NUNCA contra mi opinión sobre qué es rápido. Las
 * frases de práctica salen de la misma voz y el mismo motor, y de esas nadie
 * se ha quejado. La expectativa fonética es clara: una palabra AISLADA, dicha
 * para aprenderla, debe ir MÁS DESPACIO que la misma voz en habla corrida. Si
 * sale más rápida, el defecto está probado sin necesidad de oírla.
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/measureSpeechRate.ts --lang german [--limit 40]
 *   npx tsx scripts/measureSpeechRate.ts --url <mp3> --text "die Wartezeit"
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
// El cliente generado de este repo vive aquí, no en @prisma/client.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    let stdout = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, stderr, stdout }));
  });
}

async function durationOf(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  return Number.parseFloat(stdout.trim()) || 0;
}

/**
 * Segundos de HABLA: duración tras quitar el silencio de los dos extremos.
 * Se recorta por delante, se invierte, se recorta otra vez y se reinvierte,
 * que es la forma de que `silenceremove` toque también la cola.
 */
async function speechSeconds(mp3: Buffer, workDir: string): Promise<{ total: number; speech: number }> {
  const inPath = path.join(workDir, "in.mp3");
  const outPath = path.join(workDir, "trim.wav");
  writeFileSync(inPath, mp3);
  const total = await durationOf(inPath);
  const trim =
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01:detection=peak," +
    "areverse," +
    "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.01:detection=peak," +
    "areverse";
  const res = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", inPath, "-af", trim, outPath]);
  if (res.code !== 0) return { total, speech: total };
  return { total, speech: await durationOf(outPath) };
}

/**
 * Sílabas por núcleos vocálicos. Los diptongos cuentan como UNO: sin esto
 * "Wartezeit" daría 4 (a-e-e-i) en vez de 3 (War-te-zeit) e inflaría la tasa
 * un 33%, justo en la dirección que haría pasar por lento algo rápido.
 */
function countSyllables(text: string): number {
  const clean = text.toLowerCase().replace(/[^a-zäöüß\s]/g, " ");
  let total = 0;
  for (const word of clean.split(/\s+/).filter(Boolean)) {
    // Artículos y clíticos monosilábicos se cuentan igual, forman parte de lo
    // que la voz pronuncia.
    const merged = word
      .replace(/(au|äu|eu|ei|ai|ie)/g, "A")
      .replace(/[aeiouäöüy]+/g, "A");
    const n = (merged.match(/A/g) ?? []).length;
    total += Math.max(1, n);
  }
  return total;
}

type Sample = { label: string; text: string; url: string; kind: "palabra" | "frase" };

async function measure(sample: Sample, workDir: string) {
  const res = await fetch(sample.url);
  if (!res.ok) return { ...sample, error: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  const { total, speech } = await speechSeconds(buf, workDir);
  const syl = countSyllables(sample.text);
  const chars = sample.text.replace(/\s/g, "").length;
  if (speech <= 0.02) return { ...sample, error: "sin habla detectable" };
  return {
    ...sample,
    syl,
    total,
    speech,
    silence: total - speech,
    sylPerSec: syl / speech,
    charsPerSec: chars / speech,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    if (hit) return hit.split("=")[1];
    const idx = argv.indexOf(`--${name}`);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const workDir = mkdtempSync(path.join(tmpdir(), "speechrate-"));
  const samples: Sample[] = [];

  const oneUrl = arg("url");
  if (oneUrl) {
    samples.push({ label: arg("text") ?? "clip", text: arg("text") ?? "", url: oneUrl, kind: "palabra" });
  } else {
    const language = (arg("lang") ?? "german").toLowerCase();
    const limit = Number.parseInt(arg("limit") ?? "40", 10);

    const rows = await prisma.storyPracticeExercise.findMany({
      where: { set: { story: { journey: { language: { equals: language, mode: "insensitive" } } } } },
      select: { word: true, sentence: true, payload: true, type: true },
      take: 4000,
    });

    for (const row of rows) {
      const clip = (row.payload as Record<string, unknown> | null)?.audioClip as
        | Record<string, unknown>
        | undefined;
      if (!clip) continue;
      const wordUrl = typeof clip.wordClipUrl === "string" ? clip.wordClipUrl : null;
      const sentUrl = typeof clip.clipUrl === "string" ? clip.clipUrl : null;
      if (wordUrl && row.word && samples.filter((s) => s.kind === "palabra").length < limit) {
        samples.push({ label: row.word, text: row.word, url: wordUrl, kind: "palabra" });
      }
      if (sentUrl && row.sentence && samples.filter((s) => s.kind === "frase").length < limit) {
        samples.push({ label: row.sentence.slice(0, 40), text: row.sentence, url: sentUrl, kind: "frase" });
      }
    }
  }

  if (samples.length === 0) {
    console.log("no hay clips que medir");
    return;
  }

  const results = [];
  for (const sample of samples) {
    results.push(await measure(sample, workDir));
  }
  rmSync(workDir, { recursive: true, force: true });

  const ok = results.filter((r): r is Extract<typeof r, { sylPerSec: number }> => "sylPerSec" in r);
  const words = ok.filter((r) => r.kind === "palabra");
  const phrases = ok.filter((r) => r.kind === "frase");

  const fmt = (r: (typeof ok)[number]) =>
    `${r.label.padEnd(34).slice(0, 34)} ${r.syl.toString().padStart(3)} síl  ` +
    `${r.speech.toFixed(2)}s habla (+${r.silence.toFixed(2)}s silencio)  ` +
    `${r.sylPerSec.toFixed(2)} síl/s  ${r.charsPerSec.toFixed(1)} car/s`;

  if (words.length > 0) {
    console.log("\n── PALABRAS SUELTAS ──");
    [...words].sort((a, b) => b.sylPerSec - a.sylPerSec).forEach((r) => console.log("  " + fmt(r)));
    console.log(`  MEDIANA: ${median(words.map((r) => r.sylPerSec)).toFixed(2)} síl/s`);
  }
  if (phrases.length > 0) {
    console.log("\n── FRASES (misma voz, mismo motor, sin quejas) ──");
    [...phrases].sort((a, b) => b.sylPerSec - a.sylPerSec).slice(0, 10).forEach((r) => console.log("  " + fmt(r)));
    console.log(`  MEDIANA: ${median(phrases.map((r) => r.sylPerSec)).toFixed(2)} síl/s`);
  }

  const errs = results.filter((r) => "error" in r);
  if (errs.length > 0) {
    console.log(`\n── SIN MEDIR (${errs.length}) ──`);
    errs.slice(0, 10).forEach((r) => console.log(`  ${r.label}: ${(r as { error: string }).error}`));
  }

  if (words.length > 0 && phrases.length > 0) {
    const w = median(words.map((r) => r.sylPerSec));
    const p = median(phrases.map((r) => r.sylPerSec));
    console.log("\n── VEREDICTO ──");
    console.log(`  palabra suelta: ${w.toFixed(2)} síl/s`);
    console.log(`  habla corrida:  ${p.toFixed(2)} síl/s`);
    if (w > p) {
      console.log(
        `\n  LAS PALABRAS VAN MÁS RÁPIDAS que la voz hablando seguido (${(w / p).toFixed(2)}x).\n` +
          "  Es al revés de lo que debería: una palabra aislada, dicha para aprenderla,\n" +
          "  tiene que ir MÁS DESPACIO que la misma voz en una frase."
      );
    } else {
      console.log(`\n  Las palabras van ${(p / w).toFixed(2)}x más despacio que el habla corrida, que es lo correcto.`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
