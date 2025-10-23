// /src/lib/elevenlabs.ts
import { writeClient } from "@/sanity/lib/client";

export async function generateAndUploadAudio(
  storyText: string,
  title: string,
  language?: string,
  region?: string
): Promise<{ url: string; filename: string } | null> {
  try {
    // 🔹 Limpiar etiquetas HTML para que ElevenLabs lea texto puro
    const plainText = storyText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn("[elevenlabs] Missing ELEVENLABS_API_KEY");
      return null;
    }

    // 🔊 Selección automática de voz según idioma y región
    const voicesByLangRegion: Record<string, Record<string, string>> = {
      Spanish: {
        colombia: "b2htR0pMe28pYwCY9gnP", // Sofía (Colombia)
        mexico: "htFfPSZGJwjBv1CL0aMD", // Antonio (México)
        argentina: "p7AwDmKvTdoHTBuueGvP", // Malena (Argentina)
        default: "JddqVF50ZSIR7SRbJE6u", // Valeria (LATAM)
      },
      German: {
        germany: "K5ZVtkkBnuPY6YqXs70E", // Simon
        default: "K5ZVtkkBnuPY6YqXs70E",
      },
      English: {
        default: "21m00Tcm4TlvDq8ikWAM", // fallback general
      },
    };

    // Normalizar idioma y región
    const normalizedLang =
      (language ?? "English").trim().charAt(0).toUpperCase() +
      (language ?? "English").trim().slice(1).toLowerCase();
    const normalizedRegion = region?.toLowerCase().trim() || "default";

    // Seleccionar voz
    const selectedVoice =
      voicesByLangRegion[normalizedLang]?.[normalizedRegion] ||
      voicesByLangRegion[normalizedLang]?.default ||
      voicesByLangRegion.English.default;

    console.log(
      "[elevenlabs] Using voice",
      selectedVoice,
      "for",
      normalizedLang,
      normalizedRegion
    );

    // Generar audio con ElevenLabs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: plainText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      }
    );

    if (!response.ok) {
      console.error("[elevenlabs] Error generating audio:", await response.text());
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🔹 Generar nombre de archivo legible y único
    const safeTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const timestamp = Date.now();
    const filename = `${safeTitle}_${timestamp}.mp3`;

    // 🔹 Subir a Sanity
    const asset = await writeClient.assets.upload("file", buffer, {
      filename,
      contentType: "audio/mpeg",
    });

    if (!asset) {
      console.error("[elevenlabs] Upload failed — no asset object returned");
      return null;
    }

    // 🧩 Construir URL pública (más confiable que asset.url)
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const fileId = asset._id.replace("file-", "").replace("-mp3", "");
    const url = `https://cdn.sanity.io/files/${projectId}/${dataset}/${fileId}.mp3`;

    console.log("[elevenlabs] Uploaded audio:", filename, "→", url);

    // ✅ Devolver ambos valores
    return { url, filename };
  } catch (err) {
    console.error("[elevenlabs] Failed to generate/upload audio:", err);
    return null;
  }
}
