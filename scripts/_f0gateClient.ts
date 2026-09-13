/**
 * Cliente del gate F0 (`scripts/_f0gate.py`) que FALLA CERRADO.
 *
 * Antes, `_genWordClips.ts` y `_genPracticeClips.ts` llamaban al gate cada uno
 * a su manera y, si el gate no corria (venv o parselmouth ausentes, salida
 * distinta de 0, JSON ilegible), daban la toma por buena: ok=true por defecto.
 * El 2026-09-11 la palabra "costar" del ES Spain B1 (historia poco-y-de-oidas)
 * se subio asi, sin medir.
 *
 * Aqui no hay camino por defecto:
 *   - `preflightF0Gate()` se llama ANTES de la primera sintesis. Si el venv no
 *     existe o no importa parselmouth, tira y no se gasta un solo credito.
 *   - `runF0Gate()` devuelve el veredicto SOLO si el gate corrio y su salida
 *     tiene la forma esperada. Cualquier otra cosa tira `F0GateUnavailable`,
 *     que los generadores NO se tragan en su bucle de reintentos: paran, y la
 *     toma sin medir no se sube.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export const F0_PYTHON = join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
export const F0_SCRIPT = "scripts/_f0gate.py";

export type F0Mode = "question" | "statement" | "statement-multi";
export type F0Verdict = { ok: boolean; slope: number | null; end: number | null; reason: string };

/** El gate no pudo medir: la toma queda NO verificada y el generador para. */
export class F0GateUnavailable extends Error {
  constructor(detail: string) {
    super(`gate F0 no verificado: ${detail}`);
    this.name = "F0GateUnavailable";
  }
}

function spawnCap(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((res) => {
    let p;
    try { p = spawn(cmd, args); } catch (e) { res({ code: -1, out: "", err: (e as Error).message }); return; }
    let o = "", e = "";
    p.stdout.on("data", (c) => (o += c));
    p.stderr.on("data", (c) => (e += c));
    p.on("error", (err) => res({ code: -1, out: o, err: e || err.message }));
    p.on("close", (c) => res({ code: c ?? -1, out: o, err: e }));
  });
}

const numOrNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));

/** Parte la salida del gate. Tira si no es exactamente un veredicto valido. */
export function parseF0Output(out: string): F0Verdict {
  const line = out.trim().split("\n").pop() ?? "";
  let v: any;
  try { v = JSON.parse(line); } catch { throw new F0GateUnavailable(`salida ilegible (${line.slice(0, 80) || "vacia"})`); }
  if (!v || typeof v !== "object" || typeof v.ok !== "boolean" || !numOrNull(v.slope) || !numOrNull(v.end) || typeof v.reason !== "string")
    throw new F0GateUnavailable(`salida sin la forma esperada (${line.slice(0, 80)})`);
  return { ok: v.ok, slope: v.slope, end: v.end, reason: v.reason };
}

/** Corre el gate. `python`/`script` solo se cambian en la prueba del cliente. */
export async function runF0Gate(mp3Path: string, mode: F0Mode, opts: { python?: string; script?: string } = {}): Promise<F0Verdict> {
  const python = opts.python ?? F0_PYTHON;
  const script = opts.script ?? F0_SCRIPT;
  if (!existsSync(python)) throw new F0GateUnavailable(`no existe el python del venv (${python})`);
  if (!existsSync(mp3Path)) throw new F0GateUnavailable(`no existe el clip (${mp3Path})`);
  const r = await spawnCap(python, [script, mp3Path, mode]);
  if (r.code !== 0) throw new F0GateUnavailable(`salio con ${r.code} (${r.err.trim().slice(-160) || "sin detalle"})`);
  return parseF0Output(r.out);
}

/** Comprueba que el gate puede correr, antes de gastar creditos. */
export async function preflightF0Gate(opts: { python?: string; script?: string } = {}): Promise<void> {
  const python = opts.python ?? F0_PYTHON;
  const script = opts.script ?? F0_SCRIPT;
  if (!existsSync(python)) throw new F0GateUnavailable(`no existe el python del venv (${python})`);
  if (!existsSync(script)) throw new F0GateUnavailable(`no existe ${script} (corre desde la raiz del repo)`);
  const r = await spawnCap(python, ["-c", "import numpy, parselmouth"]);
  if (r.code !== 0) throw new F0GateUnavailable(`el venv no importa numpy/parselmouth (${r.err.trim().slice(-160) || r.code})`);
}
