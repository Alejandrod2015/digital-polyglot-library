/**
 * Re-tira el TITULO de una historia hasta que su final CAIGA, y lo empalma en
 * el master sin volver a narrar el cuerpo.
 *
 * Por que re-tirar y no reescribir: esta medido (project_tts_title_question_-
 * intonation) que un titulo que "suena a pregunta" es AZAR de la tirada, no del
 * texto; el mismo titulo da tomas de -7,3 a +2,7 st. Se re-muestrea hasta que
 * sale una que cierra.
 *
 * Cada toma se mide con el gate F0 (scripts/_f0gate.py) en modo statement, que
 * sobre un titulo es fiable porque el final esta limpio; se elige la de `end`
 * mas negativo. El bloque titulo + hueco se rellena con silencio hasta durar
 * EXACTAMENTE lo mismo que antes, para no mover ni un offset del cuerpo ni de
 * los tiempos de palabra.
 *
 * Uso:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_retiraTitulo.ts <slug> [tomas]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const PYS = [
  path.join(os.homedir(), ".cache/dpl-qa/venv/bin/python"),
  "python3",
];

function ff(args: string[]) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-300));
}
function dur(f: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]);
  return parseFloat(String(r.stdout).trim());
}
function f0(f: string): { end: number; slope: number } {
  for (const py of PYS) {
    const r = spawnSync(py, ["scripts/_f0gate.py", f, "statement"]);
    if (r.status === 0) {
      const line = String(r.stdout).trim().split("\n").pop()!;
      const j = JSON.parse(line);
      return { end: j.end, slope: j.slope };
    }
  }
  throw new Error("no pude correr el gate F0");
}

(async () => {
  const slug = process.argv[2];
  const tomas = Number(process.argv[3] ?? 6);
  if (!slug) throw new Error("falta el slug");

  const s = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { id: true, title: true, audioUrl: true, audioSegments: true, voiceId: true },
  });
  if (!s?.audioUrl) throw new Error("esa historia no tiene audio");

  const seg: any = s.audioSegments;
  const cuerpoEmpieza = Array.isArray(seg) ? Number(seg[0]?.startSec) : NaN;
  if (!Number.isFinite(cuerpoEmpieza)) throw new Error("no se donde empieza el cuerpo");

  const { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2 } =
    (await import("../src/lib/elevenlabs")) as any;
  const { uploadPublicObject } = await import("../src/lib/objectStorage");
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "titulo-"));

  const master = path.join(dir, "master.mp3");
  fs.writeFileSync(master, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
  const antes = path.join(dir, "antes.mp3");
  ff(["-i", master, "-t", String(cuerpoEmpieza), antes]);
  console.log(`titulo actual: end ${f0(antes).end} st · bloque de ${cuerpoEmpieza.toFixed(2)}s`);

  const texto = softenPunctuationForTts(`${s.title}.`);
  let mejor: { f: string; end: number; d: number } | null = null;
  for (let n = 1; n <= tomas; n++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${s.voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texto, model_id: ELEVENLABS_MODEL_V2,
        voice_settings: DEFAULT_VOICE_SETTINGS, next_text: " ",
      }),
    });
    if (!res.ok) throw new Error(`toma ${n}: ${res.status}`);
    const raw = path.join(dir, `t${n}.mp3`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    const trim = path.join(dir, `t${n}_trim.mp3`);
    ff(["-i", raw, "-af", "silenceremove=stop_periods=-1:stop_duration=0.08:stop_threshold=-45dB,loudnorm=I=-16:LRA=11:TP=-1.5", trim]);
    const m = f0(trim); const d = dur(trim);
    const cabe = d <= cuerpoEmpieza - 0.5;
    console.log(`  toma ${n}: end ${m.end} st · slope ${m.slope} · ${d.toFixed(2)}s${cabe ? "" : "  (no cabe)"}`);
    if (cabe && (!mejor || m.end < mejor.end)) mejor = { f: trim, end: m.end, d };
  }
  if (!mejor) throw new Error("ninguna toma cae ni cabe; sube el numero de tomas");
  if (mejor.end > -1) console.warn(`AVISO: la mejor solo llega a ${mejor.end} st`);

  const sil = path.join(dir, "sil.mp3");
  ff(["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(cuerpoEmpieza - mejor.d), sil]);
  const resto = path.join(dir, "resto.mp3");
  ff(["-i", master, "-ss", String(cuerpoEmpieza), resto]);
  const lista = path.join(dir, "lista.txt");
  fs.writeFileSync(lista, [mejor.f, sil, resto].map((f) => `file '${f}'`).join("\n"));
  const salida = path.join(dir, "nuevo.mp3");
  ff(["-f", "concat", "-safe", "0", "-i", lista, "-c:a", "libmp3lame", "-b:a", "192k", salida]);

  const antesD = dur(master), despuesD = dur(salida);
  console.log(`elegida: end ${mejor.end} st · master ${antesD.toFixed(2)}s -> ${despuesD.toFixed(2)}s`);
  if (Math.abs(antesD - despuesD) > 0.25) throw new Error("la duracion se movio; no subo nada");

  const up = await uploadPublicObject({
    key: `media/generated/audio/${slug}_titulo_${Date.now()}.mp3`,
    body: fs.readFileSync(salida), contentType: "audio/mpeg",
  });
  await prisma.journeyStory.update({ where: { id: s.id }, data: { audioUrl: up!.url } });
  console.log("nuevo master:", up!.url);
})().finally(() => prisma.$disconnect());
