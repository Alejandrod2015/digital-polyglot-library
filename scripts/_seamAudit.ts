/**
 * Audita las COSTURAS de un máster empalmado: lo que el detector de texto no
 * puede oír.
 *
 * POR QUÉ (2026-08-17). Corregir una frase suelta significa cortar el máster en
 * los límites de un fragmento y pegar una toma nueva. El detector de STT
 * comprueba que lo que se dice es lo que pone, y con eso se queda: no sabe si
 * el corte se NOTA. Tras catorce empalmes en un día, las tres formas de que
 * suene mal son un salto de volumen (la toma nueva se normaliza sola, el resto
 * del máster venía normalizado en otro momento), un salto de tono al reanudar,
 * y que el corte se coma el aire entre frases y las pegue.
 *
 * Mide, en cada frontera de `audioFragments`:
 *   - LUFS de los 2s anteriores y los 2s posteriores; la diferencia es el salto
 *     de volumen que el oído nota como "cambia de sitio".
 *   - si hay silencio alrededor del corte: sin aire, dos frases quedan pegadas.
 *   - F0 medio a cada lado, para ver si la voz reanuda en otro tono.
 *
 * Umbrales, del estándar de narración del proyecto: 1,5 LUFS de salto es
 * audible; menos de 0,12s de aire en una frontera es un pegote; 2 semitonos de
 * salto de tono es un cambio de voz percibido.
 *
 *   npx tsx scripts/_seamAudit.ts <slug> [<slug>...]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const F0_PY = `${process.env.HOME}/.cache/dpl-qa/venv/bin/python`;
const SALTO_LUFS = 1.5;
const AIRE_MIN = 0.12;
const SALTO_ST = 2.0;

type Frag = { index: number; startSec: number; endSec: number };

/** LUFS integrados de un tramo [ini, fin] del audio. */
function lufs(url: string, ini: number, fin: number, dir: string, tag: string): number | null {
  const f = path.join(dir, `${tag}.wav`);
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, ini)), "-t", String(Math.max(0.2, fin - ini)),
      "-i", url, "-ac", "1", "-ar", "24000", f], { stdio: "pipe" });
    const r = spawnSync("ffmpeg", ["-i", f, "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
    const m = [...String(r.stderr ?? "").matchAll(/I:\s*(-?[\d.]+)\s*LUFS/g)].pop();
    return m ? Number(m[1]) : null;
  } catch { return null; }
}

/** F0 medio (Hz) de un tramo, vía el mismo venv del gate de entonación. */
function f0medio(url: string, ini: number, fin: number, dir: string, tag: string): number | null {
  const f = path.join(dir, `${tag}_f0.wav`);
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, ini)), "-t", String(Math.max(0.3, fin - ini)),
      "-i", url, "-ac", "1", "-ar", "16000", f], { stdio: "pipe" });
    // parselmouth (Praat), el mismo motor que el gate de entonación; librosa
    // no está en este venv.
    const r = spawnSync(F0_PY, ["-c", `
import sys, numpy as np, parselmouth
snd = parselmouth.Sound(sys.argv[1])
f0 = snd.to_pitch(pitch_floor=60.0, pitch_ceiling=400.0).selected_array["frequency"]
f0 = f0[f0 > 0]
print(float(np.median(f0)) if len(f0) else "")
`, f], { encoding: "utf8" });
    const v = Number(String(r.stdout ?? "").trim());
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

/** Tramos de silencio del máster. */
function silencios(url: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const r = spawnSync("ffmpeg", ["-i", url, "-af", "silencedetect=noise=-35dB:d=0.06", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  let ini: number | null = null;
  for (const m of String(r.stderr ?? "").matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") ini = Number(m[2]);
    else if (ini !== null) { out.push([ini, Number(m[2])]); ini = null; }
  }
  return out;
}

(async () => {
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("uso: _seamAudit.ts <slug> [<slug>...]");
  let avisos = 0, costuras = 0;

  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { audioUrl: true, audioFragments: true } });
    const frags = ((s?.audioFragments as Frag[] | null) ?? []).slice().sort((a, b) => a.index - b.index);
    if (!s?.audioUrl || frags.length < 2) { console.log(`${slug}: sin máster o sin fragmentos`); continue; }
    const dir = mkdtempSync(path.join(tmpdir(), "seam-"));
    const sils = silencios(s.audioUrl);
    const malas: string[] = [];

    for (let i = 0; i < frags.length - 1; i++) {
      const corte = Number(frags[i].endSec);
      costuras++;
      const antes = lufs(s.audioUrl, corte - 2, corte - 0.05, dir, `a${i}`);
      const despues = lufs(s.audioUrl, corte + 0.05, corte + 2, dir, `d${i}`);
      const salto = antes !== null && despues !== null ? Math.abs(antes - despues) : null;

      // Aire: silencio que solape la costura.
      const aire = sils.reduce((n, [x, y]) =>
        Math.max(n, Math.min(y, corte + 0.5) - Math.max(x, corte - 0.5) > 0 ? y - x : 0), 0);

      const fa = f0medio(s.audioUrl, corte - 1.2, corte - 0.05, dir, `a${i}`);
      const fd = f0medio(s.audioUrl, corte + 0.05, corte + 1.2, dir, `d${i}`);
      const st = fa && fd ? Math.abs(12 * Math.log2(fd / fa)) : null;

      const problemas: string[] = [];
      if (salto !== null && salto > SALTO_LUFS) problemas.push(`salto de ${salto.toFixed(1)} LUFS`);
      if (aire < AIRE_MIN) problemas.push(`sin aire (${aire.toFixed(2)}s)`);
      if (st !== null && st > SALTO_ST) problemas.push(`tono +${st.toFixed(1)} st`);
      if (problemas.length) {
        avisos++;
        malas.push(`  costura [${frags[i].index}|${frags[i + 1].index}] a ${corte.toFixed(2)}s: ${problemas.join(", ")}`);
      }
    }
    console.log(`── ${slug}: ${frags.length - 1} costuras, ${malas.length} con aviso`);
    for (const m of malas) console.log(m);
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n${costuras} costuras medidas · ${avisos} con aviso`);
  console.log(`umbrales: salto > ${SALTO_LUFS} LUFS · aire < ${AIRE_MIN}s · tono > ${SALTO_ST} st`);
})().catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => p.$disconnect());
