/**
 * Limpieza de "phantom syllables" en audio multi-voz: el modelo TTS a
 * veces emite contenido vocal espurio al final de cada segmento (1-2
 * fonemas que suenan como el inicio de la siguiente palabra). Aplica
 * a TODA pipeline TTS — autorregresiva (ElevenLabs) y NAR (Kokoro,
 * Chatterbox) por igual, aunque por causas distintas.
 *
 * Solución content-aware (no umbral de silencio): aeneas alinea las
 * palabras del texto contra el audio. Cualquier audio entre el final
 * de la última palabra de un segmento y el inicio de la primera
 * palabra del siguiente es PHANTOM o silencio natural; lo
 * reemplazamos por silencio fijo. Lo que está dentro de la oración
 * (gaps cortos < threshold) se preserva intacto para que las pausas
 * naturales sigan ahí.
 *
 * Pasada única por audio completo de la historia, no por segmento;
 * es 1 llamada a Modal align en lugar de N. El splice se hace con
 * ffmpeg `atrim` + `concat` filter complex.
 */

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alignAudioOnModal } from "@/lib/audioWordTimings";
import { uploadPublicObject, getPublicObjectUrl } from "@/lib/objectStorage";

export type TrimAudioBoundariesArgs = {
  audioBuffer: Buffer;
  /** Texto plano que matchea el orden + contenido del audio.
   *  Para multi-voz: title + seg1.text + seg2.text + ... join con espacios. */
  plainText: string;
  language: string;
  /** Gap entre word_end_i y word_start_{i+1} mayor a este valor lo
   *  consideramos "límite de segmento" donde puede haber phantom.
   *  Default 0.25 s — en una oración natural rara vez hay > 250 ms
   *  de pausa entre palabras consecutivas. */
  gapThresholdSec?: number;
  /** Silencio fijo a insertar en cada límite. Default 0.35 s, igual
   *  al `DIALOGUE_PAUSE_S` que el Python script ya inserta entre
   *  segmentos sintetizados. */
  replacementSilenceSec?: number;
};

/**
 * Sube el audio a R2 con una key transitoria, llama a aeneas, y
 * usa el resultado para reconstruir el audio cortando phantom
 * syllables al final de cada segmento.
 *
 * Devuelve el buffer recortado en éxito, o `null` si la alineación
 * falló (caller debe usar el buffer original como fallback).
 */
export async function trimAudioBoundariesByAlignment(
  args: TrimAudioBoundariesArgs
): Promise<Buffer | null> {
  const gapThreshold = args.gapThresholdSec ?? 0.25;
  const replacementSilence = args.replacementSilenceSec ?? 0.35;

  // 1. Upload temporal a R2 para que aeneas tenga URL pública.
  const tempKey = `media/multivoice-align-temp/${cryptoRandomKey()}.mp3`;
  try {
    await uploadPublicObject({
      key: tempKey,
      body: args.audioBuffer,
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.warn(`[audio-boundary-trim] temp upload failed: ${msg(err)}`);
    return null;
  }
  const audioUrl = getPublicObjectUrl(tempKey);
  if (!audioUrl) {
    console.warn("[audio-boundary-trim] temp URL not resolvable");
    return null;
  }

  let tokens;
  try {
    const result = await alignAudioOnModal({
      audioUrl,
      plainText: args.plainText,
      language: args.language,
    });
    tokens = result.tokens;
  } catch (err) {
    console.warn(`[audio-boundary-trim] aeneas failed: ${msg(err)}`);
    return null;
  }

  if (!tokens || tokens.length === 0) {
    console.warn("[audio-boundary-trim] aeneas returned 0 tokens");
    return null;
  }

  // 2. Identificar "chunks" — secuencias de palabras consecutivas
  //    cuyo gap intra-chunk es < threshold. Cada chunk corresponde a
  //    una oración natural (o sub-oración con pausas cortas).
  type Chunk = { start: number; end: number };
  const chunks: Chunk[] = [];
  let chunkStart: number | null = null;
  let lastWordEnd: number | null = null;
  for (const tok of tokens) {
    const ws = typeof tok.startSec === "number" ? tok.startSec : null;
    const we = typeof tok.endSec === "number" ? tok.endSec : null;
    if (ws === null || we === null || we <= ws) continue;
    if (chunkStart === null) {
      chunkStart = Math.max(0, ws - 0.05);
      lastWordEnd = we;
      continue;
    }
    const gap = ws - (lastWordEnd ?? ws);
    if (gap > gapThreshold) {
      // Cierra el chunk anterior y arranca uno nuevo.
      chunks.push({ start: chunkStart, end: (lastWordEnd ?? ws) + 0.03 });
      chunkStart = Math.max(0, ws - 0.05);
    }
    lastWordEnd = we;
  }
  if (chunkStart !== null && lastWordEnd !== null) {
    chunks.push({ start: chunkStart, end: lastWordEnd + 0.03 });
  }
  if (chunks.length === 0) {
    console.warn("[audio-boundary-trim] no chunks derived from tokens");
    return null;
  }

  // 3. Reconstruir el audio: cada chunk se extrae con atrim, los
  //    chunks se concatenan con `replacementSilence` segundos de
  //    silencio entre ellos. Cualquier phantom + silencio natural
  //    que existía entre chunks queda eliminado y reemplazado por
  //    un silencio limpio y predecible.
  const trimmed = await spliceChunksWithFfmpeg(args.audioBuffer, chunks, replacementSilence);

  // Cleanup temp upload — best-effort. uploadPublicObject no expone
  // delete; el objeto vive en R2 hasta cleanup manual periódico.
  // Nombre con prefijo `media/multivoice-align-temp/` lo hace fácil
  // de barrer.

  return trimmed;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function cryptoRandomKey(): string {
  // Base36 random ID — colisiones imposibles en la práctica.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function spliceChunksWithFfmpeg(
  inputBuffer: Buffer,
  chunks: Array<{ start: number; end: number }>,
  silenceSec: number
): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), "boundary-trim-"));
  try {
    const inPath = join(dir, "in.mp3");
    const outPath = join(dir, "out.mp3");
    await writeFile(inPath, inputBuffer);

    // Construye filter_complex:
    //   [0:a]atrim=start=S0:end=E0,asetpts=PTS-STARTPTS[c0];
    //   ...
    //   [c0][s][c1][s][c2]concat=n=K:v=0:a=1[out]
    //
    // El silencio se genera con `anullsrc` y se duplica entre cada
    // par de chunks (no antes del primero ni después del último).
    const filters: string[] = [];
    chunks.forEach((c, i) => {
      filters.push(
        `[0:a]atrim=start=${c.start.toFixed(3)}:end=${c.end.toFixed(3)},asetpts=PTS-STARTPTS[c${i}]`
      );
    });
    // Generamos UN silencio compartible (no podemos reusar refs en
    // concat, así que generamos N-1 instances independientes).
    const silenceCount = Math.max(0, chunks.length - 1);
    for (let i = 0; i < silenceCount; i += 1) {
      filters.push(
        `anullsrc=channel_layout=mono:sample_rate=44100,atrim=duration=${silenceSec.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`
      );
    }
    // Ensambla la secuencia de inputs al concat.
    const concatInputs: string[] = [];
    chunks.forEach((_, i) => {
      concatInputs.push(`[c${i}]`);
      if (i < chunks.length - 1) concatInputs.push(`[s${i}]`);
    });
    const concatN = concatInputs.length;
    filters.push(`${concatInputs.join("")}concat=n=${concatN}:v=0:a=1[out]`);

    const filterComplex = filters.join(";");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-i", inPath,
        "-filter_complex", filterComplex,
        "-map", "[out]",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg splice exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });

    return await readFile(outPath);
  } catch (err) {
    console.warn(`[audio-boundary-trim] ffmpeg splice failed: ${msg(err)}`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
