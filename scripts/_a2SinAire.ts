/** Quita la inhalacion que queda tras el TITULO en el master de una historia,
 *  sin volver a tirar y sin mover un solo milisegundo de la duracion.
 *
 *  La deteccion vive en scripts/_a2QuitaAire.py: a 10 ms el final de la palabra
 *  y el soplo se separan; a 20 ms caen en el mismo bloque y cortarlo se come la
 *  ultima silaba (paso el 2026-09-03 con "Muy interesa").
 *
 *  Uso:  npx tsx scripts/_a2SinAire.ts <slug> [--aplica] [--ventana ini:fin]
 *
 *  --ventana fuerza los segundos a silenciar cuando el soplo PEGA a la palabra
 *  y el detector se niega por seguridad. Los tres controles siguen corriendo:
 *  la palabra no puede bajar, la duracion no puede moverse y el soplo tiene
 *  que caer 8 dB o mas. Se usa con la ventana MEDIDA a 10 ms, nunca a ojo.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs"; import * as os from "os"; import * as path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";

const p = new PrismaClient();
const PY = path.join(os.homedir(), ".cache/dpl-qa/venv/bin/python");
const ff = (a: string[]) => { const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...a]); if (r.status !== 0) throw new Error(String(r.stderr).slice(-300)); };
const dur = (f: string) => parseFloat(spawnSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).stdout.toString().trim());
const rms = (f: string, a: number, b: number) => {
  const r = spawnSync(PY, ["-c", `
import sys,wave,numpy as np
w=wave.open(sys.argv[1]);sr=w.getframerate()
x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768
s=x[int(float(sys.argv[2])*sr):int(float(sys.argv[3])*sr)]
print(round(float(20*np.log10(max(np.sqrt((s**2).mean()),1e-6))),1))`, f, String(a), String(b)]);
  return parseFloat(r.stdout.toString().trim());
};

(async () => {
  const slug = process.argv[2];
  const aplica = process.argv.includes("--aplica");
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioUrl: true, audioSegments: true } });
  if (!s?.audioUrl) throw new Error(`${slug} no tiene master`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aire-"));
  const mp3 = path.join(dir, "m.mp3"), wav = path.join(dir, "m.wav");
  spawnSync("curl", ["-sL", "-o", mp3, s.audioUrl]);
  ff(["-i", mp3, "-ac", "1", "-ar", "16000", wav]);

  // El limite es el ARRANQUE DEL CUERPO, no un numero fijo: el primer sonido
  // del cuerpo tiene agudos altos y nivel bajo durante 20 ms y se confunde con
  // una inhalacion. Con 2,5 s fijos, "las-cinco-y-media" daba falso positivo.
  const segs = (s.audioSegments as Array<{ startSec?: number }> | null) ?? [];
  const cuerpo = typeof segs[0]?.startSec === "number" ? segs[0]!.startSec! : 2.5;
  const lim = Math.max(0.8, cuerpo - 0.08);
  const forzada = (() => {
    const i = process.argv.indexOf("--ventana");
    if (i < 0) return null;
    const [a, b] = String(process.argv[i + 1]).split(":").map(Number);
    return Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null;
  })();

  const det = JSON.parse(spawnSync(PY, ["scripts/_a2QuitaAire.py", wav, String(lim)]).stdout.toString().trim());
  if (!det.ok && !forzada) { console.log(`${slug}: sin aire detectable (${det.why ?? ""})`); return; }
  const finPalabra = forzada ? forzada.a - 0.005 : det.finPalabra;
  const aireIni = forzada ? forzada.a : det.aireIni;
  const aireFin = forzada ? forzada.b : det.aireFin;
  console.log(`${slug}: palabra hasta ${finPalabra}s · aire ${aireIni}-${aireFin}s${forzada ? " (ventana forzada)" : ""}`);
  if (!forzada && aireIni - finPalabra < 0.02) { console.log("  el soplo pega a la palabra; NO toco nada"); return; }

  const ini = forzada ? forzada.a : Math.max(finPalabra + 0.03, aireIni - 0.01);
  const rampa = ini + (forzada ? 0.010 : 0.020), fin = aireFin + 0.005;
  // Corte al SAMPLE, no por fotograma. `volume=...:eval=frame` evalua la
  // ganancia una vez por fotograma de audio (1152 muestras, 26 ms en un mp3),
  // asi que el primer trozo del soplo se colaba entero: en
  // `el-dinero-sobre-la-mesa` el siseo solo bajaba de -25 a -34 dB. `atrim`
  // corta donde se le dice, y el desvanecido va en la cola del trozo de antes.
  const out = path.join(dir, "limpio.mp3");
  const desv = (rampa - ini).toFixed(3);
  ff(["-i", mp3, "-filter_complex",
    `[0:a]atrim=0:${ini},asetpts=N/SR/TB,afade=t=out:st=${(ini - Number(desv)).toFixed(3)}:d=${desv}[a];` +
    `[0:a]atrim=${ini}:${fin},asetpts=N/SR/TB,volume=0[b];` +
    `[0:a]atrim=${fin},asetpts=N/SR/TB[c];` +
    `[a][b][c]concat=n=3:v=0:a=1[out]`,
    "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", out]);
  const wav2 = path.join(dir, "l.wav"); ff(["-i", out, "-ac", "1", "-ar", "16000", wav2]);

  const antes = { palabra: rms(wav, 0, finPalabra), aire: rms(wav, rampa, aireFin), cuerpo: rms(wav, 2.5, 10) };
  const desp  = { palabra: rms(wav2, 0, finPalabra), aire: rms(wav2, rampa, aireFin), cuerpo: rms(wav2, 2.5, 10) };
  console.log(`  palabra ${antes.palabra} -> ${desp.palabra} dB · aire ${antes.aire} -> ${desp.aire} dB · cuerpo ${antes.cuerpo} -> ${desp.cuerpo} dB`);
  const dA = dur(mp3), dB = dur(out);
  console.log(`  duracion ${dA.toFixed(3)}s -> ${dB.toFixed(3)}s`);
  if (Math.abs(dA - dB) > 0.02) throw new Error("la duracion se movio; no subo nada");
  if (desp.palabra < antes.palabra - 1.5) throw new Error("el corte toco la palabra; no subo nada");
  if (desp.aire > antes.aire - 8) throw new Error("el soplo apenas baja; revisa la ventana");

  if (!aplica) { console.log("  (sin --aplica no subo nada)"); return; }
  const up = await uploadPublicObject({ key: `media/generated/audio/${slug}_limpio_${Date.now()}.mp3`, body: fs.readFileSync(out), contentType: "audio/mpeg" });
  await p.journeyStory.update({ where: { id: s.id }, data: { audioUrl: up!.url } });
  console.log("  master reemplazado:", up!.url);
})().finally(() => p.$disconnect());
