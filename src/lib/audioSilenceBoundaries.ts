/**
 * Fronteras de corte en el silencio del master.
 *
 * Criterio unico para decidir si un [startSec, endSec] guardado se puede
 * cortar sin partir una palabra. Lo usan el empalme (`assertCorteEnSilencio`
 * en audioEditorSections) y el guard previo de `_rerollSection.ts`, que antes
 * llevaban cada uno su copia.
 *
 * LOS EXTREMOS DEL MASTER SON FRONTERA (2026-09-13). El detector solo ve
 * silencio si dura al menos 0,12 s, y un master puede acabar con la voz
 * apagandose en los ultimos 0,1 s. Entonces el final real nunca sale como
 * silencio, y el ultimo fragmento de toda historia asi quedaba bloqueado con
 * "FRONTERA SOBRE VOZ" (no-voy-a-llegar-tarde el 2026-09-09, el-chiste-tan-suyo
 * el 2026-09-11, fragmento 5 hasta 65,16 s). Re-medir no lo arreglaba porque
 * el final medido sigue siendo el final del master. Cortar en un extremo no
 * deja nada al otro lado: el empalme omite el tramo anterior o el posterior,
 * asi que no hay palabra que partir ni cola vieja que sobreviva.
 */
import { spawnSync } from "node:child_process";

/** Mismo filtro que ya usaba el empalme. */
export const SILENCE_FILTER = "silencedetect=noise=-35dB:d=0.12";
/** Holgura alrededor de un silencio y de los extremos del master. */
export const BOUNDARY_TOL_SEC = 0.08;

export type Silence = [number, number];

/**
 * Lee la salida de `silencedetect`. Un silencio abierto al final (start sin
 * end, que ffmpeg deja cuando el audio acaba callado) se cierra en la
 * duracion del master si se conoce.
 */
export function parseSilences(stderr: string, durationSec?: number): Silence[] {
  const out: Silence[] = [];
  let ini: number | null = null;
  for (const m of stderr.matchAll(/silence_(start|end): ([0-9.]+)/g)) {
    if (m[1] === "start") ini = Number(m[2]);
    else if (ini !== null) { out.push([ini, Number(m[2])]); ini = null; }
  }
  if (ini !== null && durationSec !== undefined && durationSec > ini) out.push([ini, durationSec]);
  return out;
}

/**
 * Devuelve las fronteras que caen sobre voz. Vacio = se puede cortar.
 * El inicio del master y su final (con `BOUNDARY_TOL_SEC` de holgura) cuentan
 * siempre como frontera valida.
 */
export function boundariesOnVoice(args: {
  silences: Silence[];
  startSec: number;
  endSec: number;
  durationSec: number;
}): Array<["inicio" | "final", number]> {
  const { silences, startSec, endSec, durationSec } = args;
  const TOL = BOUNDARY_TOL_SEC;
  const valida = (t: number) =>
    t <= 0.05 ||
    (durationSec > 0 && t >= durationSec - TOL) ||
    silences.some(([a, b]) => t >= a - TOL && t <= b + TOL);
  return ([["inicio", startSec], ["final", endSec]] as Array<["inicio" | "final", number]>)
    .filter(([, t]) => !valida(t));
}

/**
 * Mide el master (ruta local o URL) con ffmpeg. `ok` es false si ffmpeg no
 * esta disponible o no pudo leerlo; en ese caso quien llama decide.
 */
export function measureMaster(masterPathOrUrl: string): { ok: boolean; durationSec: number; silences: Silence[] } {
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", masterPathOrUrl], { encoding: "utf8" });
  const durationSec = parseFloat(String(probe.stdout ?? "").trim()) || 0;
  const r = spawnSync("ffmpeg", ["-i", masterPathOrUrl, "-af", SILENCE_FILTER, "-f", "null", "-"], { encoding: "utf8" });
  const err = String(r.stderr ?? "");
  if (!err.includes("silencedetect")) return { ok: false, durationSec, silences: [] };
  return { ok: true, durationSec, silences: parseSilences(err, durationSec) };
}
