// /src/lib/elevenlabs.ts
import { writeClient } from "@/sanity/lib/client";

export async function generateAndUploadAudio(
  storyText: string,
  title: string,
  language?: string,
  region?: string
): Promise<string | null> {

  try {
    // 🔹 Limpiar etiquetas HTML para que ElevenLabs lea texto puro
    const plainText = storyText
      .replace(/<[^>]+>/g, " ") // quitar etiquetas
      .replace(/\s+/g, " ")     // normalizar espacios
      .trim();

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn("[elevenlabs] Missing ELEVENLABS_API_KEY");
      return null;
    }

    // 🔊 Selección automática de voz según idioma y región (versión inicial LATAM / Germany)
const voicesByLangRegion: Record<string, Record<string, string>> = {
  Spanish: {
    colombia: "b2htR0pMe28pYwCY9gnP", // Sofía (Colombia)
    mexico: "htFfPSZGJwjBv1CL0aMD", // Antonio (Mexico)
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
const normalizedLang = (language ?? "English").trim().charAt(0).toUpperCase() + (language ?? "English").trim().slice(1).toLowerCase();
const normalizedRegion = region?.toLowerCase().trim() || "default";

// Seleccionar voz
const selectedVoice =
  voicesByLangRegion[normalizedLang]?.[normalizedRegion] ||
  voicesByLangRegion[normalizedLang]?.default ||
  voicesByLangRegion.English.default;

  console.log("[elevenlabs] Using voice", selectedVoice, "for", normalizedLang, normalizedRegion);


    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
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
    });

    if (!response.ok) {
      console.error("[elevenlabs] Error generating audio:", await response.text());
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 🔹 Subir a Sanity como asset
    const asset = await writeClient.assets.upload("file", buffer, {
      filename: `${title.replace(/\s+/g, "_")}.mp3`,
      contentType: "audio/mpeg",
    });

    return asset?._id || null;
  } catch (err) {
    console.error("[elevenlabs] Failed to generate/upload audio:", err);
    return null;
  }
}
