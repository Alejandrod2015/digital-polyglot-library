/**
 * Alarga la pausa entre el título y el cuerpo en másters YA renderizados, sin
 * gastar una sola llamada de TTS.
 *
 * WHY (2026-08-17): el concat metía 0.45s en todas las costuras, así que el
 * título se pegaba al primer párrafo y sonaba a que la historia empezaba a
 * media frase. El pipeline ya usa `TITLE_GAP_SEC` para lo nuevo; esto arregla
 * lo viejo insertando el silencio que falta y desplazando los offsets.
 *
 *   npx tsx scripts/_fixTitleGap.ts <journeyId> [--apply]
 *
 * No re-sintetiza nada: corta el máster en el final del fragmento 0, mete
 * silencio y vuelve a unir. Después hay que re-alinear el karaoke.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma";
import { DIALOGUE_GAP_SEC, TITLE_GAP_SEC, normalizeLoudness } from "../src/lib/elevenlabs";
import { uploadPublicObject } from "../src/lib/objectStorage";

const exec = promisify(execFile);
const prisma = new PrismaClient();
type Frag = { index: number; startSec: number; endSec: number; [k: string]: unknown };

void (async () => {
  const journeyId = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!journeyId) { console.error("uso: _fixTitleGap.ts <journeyId> [--apply]"); process.exit(1); }

  const extra = TITLE_GAP_SEC - DIALOGUE_GAP_SEC;
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId, audioUrl: { not: null } },
    select: { id: true, slug: true, audioUrl: true, audioFilename: true, audioFragments: true },
  });

  for (const r of rows) {
    const frags = ((r.audioFragments as Frag[] | null) ?? []).slice().sort((a, b) => a.index - b.index);
    if (frags.length < 2) { console.log(`${r.slug}: sin título separado, se salta`); continue; }
    const cut = Number(frags[0].endSec);
    // El hueco NO se deduce de los offsets: en las historias empalmadas y
    // re-alineadas quedan pegados al borde y marcan 0 aunque el silencio esté
    // ahí. Midiéndolo así, el script proponía insertar de nuevo en cuatro
    // másters que ya tenían 1.10s, y habría dejado 1.75s. Se mide el AUDIO.
    let hueco = Number(frags[1].startSec) - cut;
    try {
      const tmpProbe = mkdtempSync(path.join(tmpdir(), "gapprobe-"));
      const clip = path.join(tmpProbe, "clip.mp3");
      const desde = Math.max(0, cut - 1.5);
      await exec("ffmpeg", ["-v", "error", "-y", "-ss", String(desde), "-t", "3.5",
        "-i", r.audioUrl!, "-c", "copy", clip]);
      const { stderr } = await exec("ffmpeg", ["-i", clip, "-af",
        "silencedetect=noise=-45dB:d=0.25", "-f", "null", "-"]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
      const dur = [...String(stderr).matchAll(/silence_duration:\s*([\d.]+)/g)].map((m) => Number(m[1]));
      if (dur.length) hueco = Math.max(...dur);
    } catch { /* si falla la medición, se queda el valor de los offsets */ }
    // El hueco DECLARADO no es fiable: tras re-medir, los offsets se pegan al
    // borde del silencio y marcan 0. El silencio físico sigue ahí, así que
    // cortar en ese punto e insertar ${extra}s deja el total en TITLE_GAP_SEC.
    if (hueco > TITLE_GAP_SEC - 0.35) { console.log(`${r.slug}: ya tiene ${hueco.toFixed(2)}s, se salta`); continue; }
    console.log(`${r.slug}: +${extra.toFixed(2)}s de silencio tras el título`);
    if (!apply) continue;

    const dir = mkdtempSync(path.join(tmpdir(), "titlegap-"));
    const src = path.join(dir, "src.mp3");
    writeFileSync(src, Buffer.from(await (await fetch(r.audioUrl!)).arrayBuffer()));

    const head = path.join(dir, "head.mp3"), tail = path.join(dir, "tail.mp3");
    const sil = path.join(dir, "sil.mp3"), out = path.join(dir, "out.mp3");
    await exec("ffmpeg", ["-v", "error", "-y", "-i", src, "-t", String(cut), "-c", "copy", head]);
    await exec("ffmpeg", ["-v", "error", "-y", "-ss", String(cut), "-i", src, "-c", "copy", tail]);
    const probe = await exec("ffprobe", ["-v", "error", "-select_streams", "a:0",
      "-show_entries", "stream=sample_rate,channels", "-of", "default=nw=1:nk=1", src]);
    const [sr, ch] = probe.stdout.split(/\s+/).map((n) => parseInt(n, 10));
    await exec("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i",
      `anullsrc=r=${sr || 44100}:cl=${(ch || 1) >= 2 ? "stereo" : "mono"}`,
      "-t", String(extra), "-c:a", "libmp3lame", "-b:a", "128k", sil]);
    const list = path.join(dir, "list.txt");
    writeFileSync(list, [head, sil, tail].map((p) => `file '${p}'`).join("\n"));
    await exec("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);

    const buf = await normalizeLoudness(readFileSync(out));
    const base = (r.audioFilename ?? `${r.slug}.mp3`).replace(/\.mp3$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const up = await uploadPublicObject({ key: `media/generated/audio/${base}_gap${Date.now()}.mp3`, body: buf, contentType: "audio/mpeg" });
    if (!up?.url) throw new Error("subida a R2 falló");

    // Todo lo que va después del título se desplaza; el título no se mueve.
    const nuevos = frags.map((f) => f.index === 0 ? f : ({
      ...f,
      startSec: Number((Number(f.startSec) + extra).toFixed(3)),
      endSec: Number((Number(f.endSec) + extra).toFixed(3)),
    }));
    await prisma.journeyStory.update({
      where: { id: r.id },
      data: { audioUrl: up.url, audioFragments: nuevos as never },
    });
    console.log(`   ok -> ${up.url}`);
  }
  console.log(apply ? "\nAPLICADO. Re-alinea el karaoke." : "\nsimulación: repite con --apply.");
  await prisma.$disconnect();
})();
