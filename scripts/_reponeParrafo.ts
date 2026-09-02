/**
 * Vuelve a sintetizar UN parrafo de una historia ya narrada y lo empalma en su
 * master, sin tocar el resto. Despues realinea, que recoloca todos los tiempos
 * y no gasta creditos.
 *
 * Existe porque cambiar una frase del primer parrafo no justifica pagar la
 * historia entera: en el A2, el primer parrafo es entre el 23% y el 29% del
 * texto. Es la misma tecnica de `_retiraTitulo.ts`, con una diferencia: alli el
 * bloque se rellena con silencio para que dure lo mismo, y aqui el parrafo
 * nuevo dura otra cosa, asi que el realineado posterior es obligatorio.
 *
 * Uso: DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
 *        npx tsx scripts/_reponeParrafo.ts <slug> <indice-de-parrafo-1>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { VOZ_POR_TEMA } from "./_a2Voces";

const JOURNEY = "cmtgelq560007j84n3ujx9bpd";
const prisma = new PrismaClient();

function ff(args: string[]) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-300));
}
function dur(f: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]);
  return parseFloat(String(r.stdout).trim());
}

(async () => {
  const slug = process.argv[2];
  const idx = Number(process.argv[3] ?? 1);
  if (!slug) throw new Error("uso: _reponeParrafo.ts <slug> <n>");

  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { id: true, title: true, text: true, topic: true, audioUrl: true, audioSegments: true },
  });
  if (!s?.audioUrl || !s.text) throw new Error(`${slug} no tiene audio o texto`);

  const pars = s.text.split(/\n\n+/);
  const nuevo = pars[idx - 1];
  if (!nuevo) throw new Error(`la historia no tiene parrafo ${idx}`);

  // Donde acaba el parrafo viejo en el master: el ultimo segmento cuyo texto
  // pertenece a ese bloque. Con idx=1 basta el arranque del cuerpo siguiente.
  const seg = (s.audioSegments as Array<{ text: string; startSec: number; endSec: number }>) ?? [];
  if (!seg.length) throw new Error("sin audioSegments, no se donde cortar");
  const viejo = String((await prisma.journeyStory.findFirst({ where: { id: s.id }, select: { audioWordTimings: true } }))
    ?.audioWordTimings as any)?.length ? null : null;
  const foto = ((await prisma.journeyStory.findFirst({ where: { id: s.id }, select: { audioWordTimings: true } }))!
    .audioWordTimings as any)?.storyPlainText as string;
  const bloquesViejos = String(foto ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const bloqueViejo = bloquesViejos[idx - 1];
  if (!bloqueViejo) throw new Error("no encuentro el bloque viejo en los tiempos");

  const ultima = bloqueViejo.split(/(?<=[.?!”])\s+/).filter(Boolean).pop()!;
  const corte = seg.find((x) => ultima.includes(x.text.trim()) || x.text.trim().includes(ultima.slice(-40)));
  if (!corte) throw new Error("no localizo el final del parrafo en los segmentos");
  console.log(`${slug} · parrafo ${idx} acaba en ${corte.endSec.toFixed(2)}s del master`);

  const voiceId = VOZ_POR_TEMA[s.topic];
  const res = await generateAndUploadMultiVoiceAudio({
    title: s.title, storyText: nuevo, voiceMap: { narrator: voiceId },
    language: "spanish", antiUptalkGate: true, contentGate: true,
  });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parrafo-"));
  const cabeza = path.join(dir, "cabeza.mp3");
  fs.writeFileSync(cabeza, Buffer.from(await (await fetch(res.url)).arrayBuffer()));
  const master = path.join(dir, "master.mp3");
  fs.writeFileSync(master, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
  const cola = path.join(dir, "cola.mp3");
  ff(["-i", master, "-ss", String(corte.endSec), cola]);

  const lista = path.join(dir, "lista.txt");
  fs.writeFileSync(lista, [cabeza, cola].map((f) => `file '${f}'`).join("\n"));
  const salida = path.join(dir, "nuevo.mp3");
  ff(["-f", "concat", "-safe", "0", "-i", lista, "-c:a", "libmp3lame", "-b:a", "192k", salida]);
  console.log(`master ${dur(master).toFixed(1)}s -> ${dur(salida).toFixed(1)}s`);

  const { uploadPublicObject } = await import("../src/lib/objectStorage");
  const up = await uploadPublicObject({
    key: `media/generated/audio/${slug}_p${idx}_${Date.now()}.mp3`,
    body: fs.readFileSync(salida), contentType: "audio/mpeg",
  });
  await prisma.journeyStory.update({ where: { id: s.id }, data: { audioUrl: up!.url } });
  await generateWordTimingsForStory(s.id);
  console.log("nuevo master:", up!.url, "· realineado");
})().finally(() => prisma.$disconnect());
