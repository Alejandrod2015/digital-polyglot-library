// /src/lib/elevenlabs.ts
import OpenAI from "openai";
import crypto from "node:crypto";
import { sanityWriteClient } from "@/sanity";
import { buildAudioSegmentsFromTranscript, type AudioSegment, type TranscriptSegment } from "@/lib/audioSegments";
import { analyzeDeliveryQuality, analyzeTranscriptQuality, type AudioQaResult } from "@/lib/audioQa";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";

// Default ElevenLabs voice settings used across all journey TTS calls.
//   stability=0.9        más alta que 0.8 anterior. Bajaba la incidencia
//                         de "phantom syllable" al final de la oración —
//                         el modelo autorregresivo dejaba de generar 1-2
//                         fonemas extra antes del stop. Trade-off: voces
//                         menos expresivas; aceptable para A1/A2.
//   similarity_boost=0.8 keeps each voice recognizable.
//   style=0              suppresses model-added expressive style.
//   speed=0.9            10% slower so A1/A2 learners can follow along.
//   use_speaker_boost    sharpens consonants for clearer foreign-word delivery.
export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.9,
  similarity_boost: 0.8,
  style: 0,
  speed: 0.9,
  use_speaker_boost: true,
} as const;

// Ambient bed volume (0.0-1.0). 0.10 keeps the room tone present without
// fighting the dialogue. 0.15 was a touch hot.
export const DEFAULT_AMBIENT_VOLUME = 0.10;

// Approved native-German voices for multi-character dialogue stories. All IDs
// were verified against the ElevenLabs shared library with langs=de:standard.
// Previous code labelled Ww7Sq9tx9CCOiNOwWgsx as "Carl" but that voice is
// actually Moritz Morgenstern. Banned per user feedback: Thorsten variants,
// Bark Speaker 3, Simon Sunday. Earlier American-accent picks (Liam, Sarah)
// have been retired because the gringo accent leaks through eleven_multilingual_v2.
export const GERMAN_DIALOGUE_VOICES = {
  // All native-DE. License terms verified against the ElevenLabs API:
  //   moritz, enniah → premade default voices (no notice_period, perpetual)
  //   eleonore, luca → professional shared, 730 days (2 years, max available)
  // No US-accent voices in this set (Sarah and Liam retired).
  //
  // BANNED voices (do NOT add back):
  //   - Thorsten (Piper/Coqui, all variants) — monotone "deprimente"
  //   - Bark Speaker 3 — muffled / monotone
  //   - Simon Sunday (ElevenLabs) — monotone "deprimente"
  //   - Sebastian "qVRpsZJDV29g1CIPzssm" — uptalk; every line ends like a
  //     question. Rejected when used as a 9-year-old. Replaced by Luca.
  moritz:    "Ww7Sq9tx9CCOiNOwWgsx", // M middle-aged, native DE, baritone — narrator
  enniah:    "WHaUUVTDq47Yqc9aDbkH", // F middle-aged, native DE, warm — primary female
  gesaTess:  "cllvQaMvj0ZKxH88HGEn", // F middle-aged, native DE, "trustworthy host" — calmer baseline than ENNIAH
  luca:      "mmAbrxFQ9xjByXyBpqrK", // M young, native DE, dynamic engaging — younger male (replaces banned Sebastian)
  eleonore:  "8SdTD5IMgFKT1jp7JbPC", // F middle-aged, native DE, mature narrator — "Frau" roles
} as const;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeLanguageName(value?: string): string {
  const raw = (value ?? "English").trim().toLowerCase();
  if (!raw) return "English";

  const aliases: Record<string, string> = {
    english: "English",
    spanish: "Spanish",
    german: "German",
    italian: "Italian",
    french: "French",
    français: "French",
    francais: "French",
    portuguese: "Portuguese",
    português: "Portuguese",
    portugues: "Portuguese",
  };

  return aliases[raw] ?? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

function normalizeRegionName(value?: string): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "default";

  const aliases: Record<string, string> = {
    colombia: "colombia",
    mexico: "mexico",
    méxico: "mexico",
    argentina: "argentina",
    peru: "peru",
    perú: "peru",
    germany: "germany",
    deutschland: "germany",
    italy: "italy",
    italia: "italy",
    france: "france",
    francia: "france",
    brazil: "brazil",
    brasil: "brazil",
    portugal: "portugal",
  };

  return aliases[raw] ?? raw;
}

function selectVoiceId(candidates: string[], seed: string): string {
  if (candidates.length === 0) {
    throw new Error("No voice candidates provided");
  }
  if (candidates.length === 1) return candidates[0];
  return candidates[hashSeed(seed) % candidates.length];
}

export function buildAudioNarrationText(title: string, storyText: string): string {
  const plainTitle = title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const plainStory = storyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const titleWithPause =
    plainTitle.length === 0
      ? ""
      : /[.!?…:]$/.test(plainTitle)
        ? plainTitle
        : `${plainTitle}.`;

  if (!titleWithPause) return plainStory;
  if (!plainStory) return titleWithPause;

  return `${titleWithPause}\n\n${plainStory}`;
}

export async function generateAndUploadAudio(
  storyText: string,
  title: string,
  language?: string,
  region?: string
): Promise<{
  url: string;
  filename: string;
  assetId: string | null;
  audioSegments: AudioSegment[];
  audioQa: AudioQaResult;
  voiceId: string;
} | null> {
  try {
    // 🔹 El audio debe narrar primero el título, luego hacer una pausa y empezar la historia.
    const narrationText = buildAudioNarrationText(title, storyText);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("[elevenlabs] ❌ Missing ELEVENLABS_API_KEY");
      return null;
    }

    // 🔊 Selección automática de voz según idioma y región
    const voicesByLangRegion: Record<string, Record<string, string[]>> = {
      Spanish: {
        colombia: ["b2htR0pMe28pYwCY9gnP"], // Sofía (Colombia)
        mexico: ["htFfPSZGJwjBv1CL0aMD"], // Antonio (México)
        argentina: ["p7AwDmKvTdoHTBuueGvP"], // Malena (Argentina)
        peru: ["JddqVF50ZSIR7SRbJE6u"], // Valeria (LATAM)
        default: ["JddqVF50ZSIR7SRbJE6u"],
      },
      German: {
        germany: ["Ww7Sq9tx9CCOiNOwWgsx"], // Carl
        default: ["Ww7Sq9tx9CCOiNOwWgsx"], // Carl
      },
      English: {
        default: ["21m00Tcm4TlvDq8ikWAM"], // Rachel
      },
      Italian: {
        italy: ["W71zT1VwIFFx3mMGH2uZ"], // Marcotrox
        default: ["gfKKsLN1k0oYYN9n2dXX"], // Violetta
      },
      French: {
        france: [
          "sANWqF1bCMzR6eyZbCGw", // Marie
          "kENkNtk0xyzG09WW40xE", // Marcel
          "IPgYtHTNLjC7Bq7IPHrm", // Alexandre
        ],
        default: [
          "sANWqF1bCMzR6eyZbCGw", // Marie
          "kENkNtk0xyzG09WW40xE", // Marcel
          "IPgYtHTNLjC7Bq7IPHrm", // Alexandre
        ],
      },
      Portuguese: {
        brazil: ["aU2vcrnwi348Gnc2Y1si"], // José
        portugal: ["5tqq6ewvJtcNtaffrqUJ"], // Duarte
        default: ["aU2vcrnwi348Gnc2Y1si", "5tqq6ewvJtcNtaffrqUJ"],
      },
    };

    // Normalizar idioma y región
    const normalizedLang = normalizeLanguageName(language);
    const normalizedRegion = normalizeRegionName(region);

    // Seleccionar voz
    const voiceCandidates =
      voicesByLangRegion[normalizedLang]?.[normalizedRegion] ||
      voicesByLangRegion[normalizedLang]?.default ||
      voicesByLangRegion.English.default;
    const selectedVoice = selectVoiceId(voiceCandidates, `${normalizedLang}:${normalizedRegion}:${title}`);

    console.log(
      `[elevenlabs] 🎙 Using voice ${selectedVoice} for ${normalizedLang} (${normalizedRegion})`
    );

    // 🧠 Llamar a ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: softenPunctuationForTts(narrationText),
          model_id: "eleven_multilingual_v2",
          voice_settings: DEFAULT_VOICE_SETTINGS,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs] ❌ Error generating audio:", errText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const buffer = await normalizeLoudness(rawBuffer);
    // 📁 Crear nombre de archivo seguro
    const filename = `${filenameFromTitle(title)}_${Date.now()}.mp3`;
    const transcription = await transcribeAudioSegments(buffer, filename, narrationText);
    const audioQa = analyzeTranscriptQuality(narrationText, transcription.transcriptText);

    console.log("[elevenlabs] ⬆ Uploading audio...");

    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${filename}`,
      body: buffer,
      contentType: "audio/mpeg",
    });

    if (uploaded?.url) {
      console.log("[elevenlabs] ✅ Audio uploaded to object storage:", filename, "→", uploaded.url);

      return {
        url: uploaded.url,
        filename,
        assetId: null,
        audioSegments: transcription.audioSegments,
        audioQa,
        voiceId: `elevenlabs/${selectedVoice}`,
      };
    }

    console.log("[elevenlabs] ↩ Falling back to Sanity asset storage");

    const asset = await sanityWriteClient.assets.upload("file", buffer, {
      filename,
      contentType: "audio/mpeg",
    });

    if (!asset?._id) {
      console.error("[elevenlabs] ❌ Sanity upload failed (no asset returned)");
      return null;
    }

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const fileId = asset._id.replace("file-", "").replace("-mp3", "");
    const url = `https://cdn.sanity.io/files/${projectId}/${dataset}/${fileId}.mp3`;

    console.log("[elevenlabs] ✅ Audio uploaded to Sanity:", filename, "→", url);

    return {
      url,
      filename,
      assetId: asset._id,
      audioSegments: transcription.audioSegments,
      audioQa,
      voiceId: `elevenlabs/${selectedVoice}`,
    };
  } catch (err) {
    console.error("[elevenlabs] 💥 Failed to generate/upload audio:", err);
    return null;
  }
}

// Best-effort loudness normalization via ffmpeg's dynaudnorm + loudnorm
// filters. dynaudnorm smooths volume between speaker segments inside a single
// file; loudnorm hits a podcast-standard target so all stories sit at the same
// listening level. If ffmpeg isn't available in the runtime (e.g. some
// serverless environments) we log and return the original buffer so audio
// generation still succeeds.
async function normalizeLoudness(buffer: Buffer): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");

    const dir = await mkdtemp(path.join(tmpdir(), "loudnorm-"));
    try {
      const inPath = path.join(dir, "in.mp3");
      const outPath = path.join(dir, "out.mp3");
      await writeFile(inPath, buffer);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", [
          "-y",
          "-loglevel", "error",
          "-i", inPath,
          "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
          "-codec:a", "libmp3lame",
          "-b:a", "128k",
          outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
        });
      });
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[elevenlabs] loudness normalization skipped:", err instanceof Error ? err.message : err);
    return buffer;
  }
}

// Some ElevenLabs voices over-emote on exclamation marks, treating "!" as a
// strong cue for cheerfulness or animation. For language-learning A1/A2
// stories the result sounds fake. This softener flattens "!" to "." before
// TTS while preserving "?" (we want question intonation). The original story
// text in the DB is not touched — this only affects the audio layer.
export function softenPunctuationForTts(text: string): string {
  return text.replace(/!+/g, ".").replace(/\.{2,}/g, ".");
}

// Parses a story body that opens with a narrator paragraph and then has
// "Speaker: line" turns into a list of segments tagged with the speaker name.
// Multi-paragraph narrator blocks are merged. Empty lines are dropped.
export type DialogueSegment = { speaker: string; text: string };

const SPEAKER_LABEL_REGEX =
  /^\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;

export function parseDialogueSegments(storyText: string): DialogueSegment[] {
  const cleaned = storyText.replace(/<[^>]+>/g, " ");
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim());
  const segments: DialogueSegment[] = [];
  let narratorBuffer: string[] = [];
  const flushNarrator = () => {
    if (narratorBuffer.length === 0) return;
    const text = narratorBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) segments.push({ speaker: "narrator", text });
    narratorBuffer = [];
  };
  for (const line of lines) {
    if (!line) continue;
    const m = line.match(SPEAKER_LABEL_REGEX);
    if (m) {
      flushNarrator();
      segments.push({ speaker: m[1].trim(), text: m[2].trim() });
    } else {
      narratorBuffer.push(line);
    }
  }
  flushNarrator();
  return segments;
}

// Per-segment cache key for the multi-voice pipeline. Hashing (voiceId,
// softened text, voice settings hash) means swapping a single character's
// voice in a story re-generates only that character's segments; the
// narrator and other speakers serve from R2 for free.
//
// Sufijos del key (versionados para invalidar cache cuando cambia el
// pipeline):
//   trim-v1: se agregó silenceremove para limpiar artefactos de cola.
//   trim-v2: stability 0.8→0.9 + previous_text/next_text + end-trim
//            duro de 60 ms para matar la "phantom syllable" que aparecía
//            al final de la oración aunque silenceremove no la tocara.
function multivoiceSegmentCacheKey(voiceId: string, softenedText: string): string {
  const settingsFingerprint = JSON.stringify(DEFAULT_VOICE_SETTINGS);
  const hash = crypto
    .createHash("sha256")
    .update(`${voiceId}|${settingsFingerprint}|${softenedText}|trim-v2`)
    .digest("hex")
    .slice(0, 24);
  return `media/multivoice-segments/${hash}.mp3`;
}

// Pasa el buffer del segmento por dos limpiezas en cascada:
//
// 1. `silenceremove` con threshold -45 dB / duración mínima 50 ms en
//    ambos extremos. Quita el silencio inicial con click de attack, y
//    la cola con breaths/vocal-fry/mouth-clicks que `eleven_multilingual_v2`
//    encadena al final de la oración.
//
// 2. End-trim duro de 60 ms via `areverse → atrim → asetpts → areverse`.
//    Esto recorta contenido aunque NO sea silencio — es el único modo
//    de matar la "phantom syllable" donde el modelo autorregresivo
//    genera 1-2 fonemas del próximo token antes del stop signal.
//    silenceremove con threshold normal no lo toca porque es vocal.
//    60 ms es agresivo pero deja intacta la última sílaba en speed=0.9
//    (~70-90 ms por fonema final). Si recorta demasiado, ajustar a 40 ms.
//
// Re-encoda a 192 kbps (mismo bitrate que sirve el endpoint TTS) así el
// concat posterior no muestra discontinuidades de bitstream.
async function trimSegmentArtifacts(buffer: Buffer): Promise<Buffer> {
  const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");

  const dir = await mkdtemp(path.join(tmpdir(), "trim-"));
  try {
    const inPath = path.join(dir, "in.mp3");
    const outPath = path.join(dir, "out.mp3");
    await writeFile(inPath, buffer);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-i", inPath,
        "-af",
        // Pasada 1: silenceremove en ambos extremos.
        "silenceremove=" +
          "start_periods=1:start_duration=0.05:start_threshold=-45dB:" +
          "stop_periods=-1:stop_duration=0.05:stop_threshold=-45dB," +
          // Pasada 2: end-trim duro de 60 ms vía reverse-trim-reverse.
          "areverse,atrim=start=0.06,asetpts=PTS-STARTPTS,areverse",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg trim exit ${code}: ${stderr.slice(0, 400)}`));
      });
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ttsSegment(args: {
  text: string;
  voiceId: string;
  apiKey: string;
  /** Texto del segmento previo (mismo voiceId o no). Le da al modelo
   *  contexto histórico para que la prosodia inicial encaje con lo
   *  ya dicho. Limit ~500 chars; sino el modelo se distrae. */
  previousText?: string;
  /** Texto del próximo segmento. Le indica al modelo dónde termina
   *  exactamente el segmento actual; sin esto, eleven_multilingual_v2
   *  a veces genera 1-2 fonemas del siguiente token (la "phantom
   *  syllable" reportada). Pasar incluso un espacio o "." ayuda. */
  nextText?: string;
}): Promise<Buffer | null> {
  const softened = softenPunctuationForTts(args.text);

  // Cache lookup: same voice + same text (after softening) + same voice
  // settings → reuse the previously generated MP3 from R2 instead of paying
  // ElevenLabs again.
  // Nota: previousText/nextText NO van en la cache key. Cambiarlos
  // produciría un audio ligeramente distinto pero no significativamente
  // — y meterlos rompería la propiedad "regenero solo lo que cambió".
  const cacheKey = multivoiceSegmentCacheKey(args.voiceId, softened);
  const cacheUrl = getPublicObjectUrl(cacheKey);
  if (cacheUrl) {
    try {
      const head = await fetch(cacheUrl, { method: "HEAD" });
      if (head.ok) {
        const get = await fetch(cacheUrl);
        if (get.ok) {
          console.log(`[elevenlabs] segment cache hit ${cacheKey}`);
          return Buffer.from(await get.arrayBuffer());
        }
      }
    } catch {
      // Cache lookup failed (network, etc.). Fall through to fresh generation.
    }
  }

  const requestBody: Record<string, unknown> = {
    text: softened,
    model_id: "eleven_multilingual_v2",
    voice_settings: DEFAULT_VOICE_SETTINGS,
  };
  // ElevenLabs API: previous_text/next_text dan al modelo contexto
  // sobre lo que pasa antes/después del segmento actual sin consumir
  // caracteres del cuota. Sirve para que la prosodia fluya (previous)
  // y para señalizar boundaries explícitos (next) — el último previene
  // la "phantom syllable" mejor que cualquier post-process. Default a
  // " " si no se pasa, así el modelo siempre tiene un boundary signal.
  const prev = args.previousText?.trim();
  if (prev) requestBody.previous_text = prev.slice(-500);
  requestBody.next_text = args.nextText?.trim() ? args.nextText.trim().slice(0, 500) : " ";

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
    {
      method: "POST",
      headers: { "xi-api-key": args.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    console.error(`[elevenlabs] segment TTS failed for voice ${args.voiceId}: ${response.status} ${err.slice(0, 200)}`);
    return null;
  }
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  // Pasa por silenceremove para limpiar la cola de artefactos. Si ffmpeg
  // falla (binario ausente, segmento corrupto), caemos al buffer crudo
  // así el pipeline nunca se queda sin audio por un fallo de filtro.
  const cleanedBuffer = await trimSegmentArtifacts(rawBuffer).catch((err) => {
    console.warn(
      `[elevenlabs] segment trim failed, using raw buffer: ${err instanceof Error ? err.message : err}`
    );
    return rawBuffer;
  });

  // Best-effort cache write. If R2 isn't configured or upload fails, the
  // current generation still succeeds; the next regen will just miss again.
  try {
    await uploadPublicObject({
      key: cacheKey,
      body: cleanedBuffer,
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.warn(`[elevenlabs] segment cache write failed: ${err instanceof Error ? err.message : err}`);
  }

  return cleanedBuffer;
}

// Each ElevenLabs MP3 starts with a Xing/Info frame announcing the per-segment
// duration. A naive Buffer.concat leaves multiple Xing frames inside the file,
// which makes ffprobe (and some seekbars) report wrong durations and emit
// "invalid concatenated file detected" warnings. Running the segments through
// ffmpeg's concat demuxer produces a single clean MP3 with one Xing frame.
async function concatMp3Buffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length <= 1) return Buffer.concat(buffers);
  const { writeFile, mkdtemp, rm } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");

  const dir = await mkdtemp(path.join(tmpdir(), "mvtts-"));
  try {
    const segPaths: string[] = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const p = path.join(dir, `seg-${String(i).padStart(3, "0")}.mp3`);
      await writeFile(p, buffers[i]);
      segPaths.push(p);
    }
    const listPath = path.join(dir, "list.txt");
    await writeFile(listPath, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    const outPath = path.join(dir, "out.mp3");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });

    const { readFile } = await import("fs/promises");
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Mix a looped ambient track underneath an already-synthesized dialogue
// buffer. Volume defaults to 0.15 (15%) so voices stay clearly on top.
// Returns the original buffer if ffmpeg or the ambient file isn't available.
async function mixAmbient(
  dialogue: Buffer,
  ambientPath: string,
  volume = 0.15
): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile, access } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");

    await access(ambientPath); // throws if missing
    const dir = await mkdtemp(path.join(tmpdir(), "ambient-"));
    try {
      const inPath = path.join(dir, "in.mp3");
      const outPath = path.join(dir, "out.mp3");
      await writeFile(inPath, dialogue);
      await new Promise<void>((resolve, reject) => {
        const filter =
          `[1:a]volume=${volume},afade=t=in:st=0:d=1[a1];` +
          `[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
          `[mix]loudnorm=I=-16:LRA=11:TP=-1.5`;
        const proc = spawn("ffmpeg", [
          "-y", "-loglevel", "error",
          "-i", inPath,
          "-stream_loop", "-1", "-i", ambientPath,
          "-filter_complex", filter,
          "-codec:a", "libmp3lame", "-b:a", "128k",
          outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
        });
      });
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[elevenlabs] ambient mix skipped:", err instanceof Error ? err.message : err);
    return dialogue;
  }
}

/**
 * Generate audio for a multi-character dialogue story by synthesizing each
 * speaker's segment with a distinct voice and stitching the resulting MP3s.
 * The title is prepended (narrated by the narrator voice) followed by a
 * sentence-end pause from punctuation; no speaker labels are spoken aloud.
 *
 * Optionally mixes a looped ambient track (cafeteria, mercado, etc.)
 * underneath the dialogue at low volume.
 */
export async function generateAndUploadMultiVoiceAudio(args: {
  storyText: string;
  title: string;
  voiceMap: Record<string, string>; // speaker name (lowercased) → voice ID; "narrator" key required
  ambientPath?: string | null;       // absolute path to a looped ambient MP3
  ambientVolume?: number;            // 0.0-1.0, default 0.15
}): Promise<{
  url: string;
  filename: string;
  audioSegments: AudioSegment[];
  audioQa: AudioQaResult;
  speakerVoiceMap: Record<string, string>;
} | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[elevenlabs] ❌ Missing ELEVENLABS_API_KEY");
    return null;
  }

  const segments = parseDialogueSegments(args.storyText);
  if (segments.length === 0) {
    console.error("[elevenlabs] no segments parsed from story text");
    return null;
  }

  const lowerVoiceMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(args.voiceMap)) lowerVoiceMap[k.toLowerCase()] = v;
  const narratorVoice = lowerVoiceMap.narrator;
  if (!narratorVoice) {
    console.error("[elevenlabs] voiceMap is missing the required 'narrator' key");
    return null;
  }

  // Title narration first (no speaker label), then each segment.
  const titleClean = args.title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleText = titleClean
    ? /[.!?…:]$/.test(titleClean)
      ? titleClean
      : `${titleClean}.`
    : "";

  const audioBuffers: Buffer[] = [];
  // Construimos la lista completa de "fragments-a-sintetizar" (title +
  // segmentos en orden) para poder pasar previous_text/next_text con
  // el contexto real de cada uno. Sin esto, ElevenLabs trata cada
  // segmento como una oración aislada y a veces le agrega 1-2 fonemas
  // del próximo token antes del stop signal (la "phantom syllable").
  type Frag = { text: string; voiceId: string };
  const fragments: Frag[] = [];
  if (titleText) fragments.push({ text: titleText, voiceId: narratorVoice });
  for (const seg of segments) {
    const voiceId = lowerVoiceMap[seg.speaker.toLowerCase()] ?? narratorVoice;
    fragments.push({ text: seg.text, voiceId });
  }
  for (let i = 0; i < fragments.length; i += 1) {
    const frag = fragments[i];
    const previousText = i > 0 ? fragments[i - 1].text : undefined;
    const nextText = i + 1 < fragments.length ? fragments[i + 1].text : " ";
    const buf = await ttsSegment({
      text: frag.text,
      voiceId: frag.voiceId,
      apiKey,
      previousText,
      nextText,
    });
    if (!buf) return null;
    audioBuffers.push(buf);
  }

  const concatBuffer = await concatMp3Buffers(audioBuffers);
  const normalized = await normalizeLoudness(concatBuffer);
  const combined = args.ambientPath
    ? await mixAmbient(normalized, args.ambientPath, args.ambientVolume ?? DEFAULT_AMBIENT_VOLUME)
    : normalized;
  const filename = `${filenameFromTitle(args.title)}_multivoice_${Date.now()}.mp3`;

  const transcription = await transcribeAudioSegments(combined, filename, [titleText, ...segments.map((s) => s.text)].join(" "));
  const audioQa = analyzeTranscriptQuality(
    [titleText, ...segments.map((s) => s.text)].join(" "),
    transcription.transcriptText
  );

  console.log("[elevenlabs] ⬆ Uploading multi-voice audio...");
  const uploaded = await uploadPublicObject({
    key: `media/generated/audio/${filename}`,
    body: combined,
    contentType: "audio/mpeg",
  });
  if (!uploaded?.url) {
    console.error("[elevenlabs] upload failed");
    return null;
  }

  const speakerVoiceMap: Record<string, string> = {};
  for (const seg of segments) {
    const key = seg.speaker.toLowerCase();
    speakerVoiceMap[seg.speaker] = lowerVoiceMap[key] ?? narratorVoice;
  }

  return {
    url: uploaded.url,
    filename,
    audioSegments: transcription.audioSegments,
    audioQa,
    speakerVoiceMap,
  };
}

export async function analyzeExistingAudio(
  audioBuffer: Buffer,
  expectedText: string,
  title: string
): Promise<AudioQaResult> {
  const filename = `${filenameFromTitle(title || "audio_qa")}_qa.mp3`;
  const transcription = await transcribeAudioSegments(audioBuffer, filename, expectedText);
  return analyzeTranscriptQuality(expectedText, transcription.transcriptText);
}

export async function analyzeExistingAudioDelivery(
  audioBuffer: Buffer,
  expectedText: string,
  title: string
): Promise<AudioQaResult> {
  const filename = `${filenameFromTitle(title || "audio_delivery_qa")}_delivery.mp3`;
  const transcription = await transcribeAudioSegments(audioBuffer, filename, expectedText);
  return analyzeDeliveryQuality(expectedText, transcription.audioSegments);
}

function filenameFromTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

async function transcribeAudioSegments(
  buffer: Buffer,
  filename: string,
  narrationText: string
): Promise<{ audioSegments: AudioSegment[]; transcriptText: string | null }> {
  if (!openai) {
    console.warn("[audio-segments] Missing OPENAI_API_KEY, skipping segment generation");
    return { audioSegments: [], transcriptText: null };
  }

  try {
    const fileBytes = new Uint8Array(buffer);
    const file = new File([fileBytes], filename, { type: "audio/mpeg" });
    const transcript = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      prompt: narrationText,
    });

    const rawSegments =
      "segments" in transcript && Array.isArray(transcript.segments)
        ? (transcript.segments as TranscriptSegment[])
        : [];

    return {
      audioSegments: buildAudioSegmentsFromTranscript(rawSegments),
      transcriptText: typeof transcript.text === "string" ? transcript.text : null,
    };
  } catch (error) {
    console.error("[audio-segments] Failed to build segments from transcription:", error);
    return { audioSegments: [], transcriptText: null };
  }
}
