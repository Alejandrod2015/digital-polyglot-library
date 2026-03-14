// /src/lib/elevenlabs.ts
import OpenAI from "openai";
import { sanityWriteClient } from "@/sanity";
import { buildAudioSegmentsFromTranscript, type AudioSegment, type TranscriptSegment } from "@/lib/audioSegments";
import { analyzeDeliveryQuality, analyzeTranscriptQuality, type AudioQaResult } from "@/lib/audioQa";

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
  assetId: string;
  audioSegments: AudioSegment[];
  audioQa: AudioQaResult;
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
          text: narrationText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs] ❌ Error generating audio:", errText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // 📁 Crear nombre de archivo seguro
    const filename = `${filenameFromTitle(title)}_${Date.now()}.mp3`;
    const transcription = await transcribeAudioSegments(buffer, filename, narrationText);
    const audioQa = analyzeTranscriptQuality(narrationText, transcription.transcriptText);

    console.log("[elevenlabs] ⬆ Uploading to Sanity...");

    // ✅ Subir archivo MP3 a Sanity con permisos de escritura
    const asset = await sanityWriteClient.assets.upload("file", buffer, {
      filename,
      contentType: "audio/mpeg",
    });

    if (!asset?._id) {
      console.error("[elevenlabs] ❌ Sanity upload failed (no asset returned)");
      return null;
    }

    // 🧩 Construir URL pública desde asset ID
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const fileId = asset._id.replace("file-", "").replace("-mp3", "");
    const url = `https://cdn.sanity.io/files/${projectId}/${dataset}/${fileId}.mp3`;

    console.log("[elevenlabs] ✅ Audio uploaded:", filename, "→", url);

    return {
      url,
      filename,
      assetId: asset._id,
      audioSegments: transcription.audioSegments,
      audioQa,
    };
  } catch (err) {
    console.error("[elevenlabs] 💥 Failed to generate/upload audio:", err);
    return null;
  }
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
