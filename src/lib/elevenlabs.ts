// /src/lib/elevenlabs.ts
import { sanityWriteClient } from "@/sanity";

export async function generateAndUploadAudio(
  storyText: string,
  title: string,
  language?: string,
  region?: string
): Promise<{ url: string; filename: string } | null> {
  try {
    // 🔹 Limpiar etiquetas HTML para enviar texto limpio a ElevenLabs
    const plainText = storyText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("[elevenlabs] ❌ Missing ELEVENLABS_API_KEY");
      return null;
    }

    // 🔊 Selección automática de voz según idioma y región
    const voicesByLangRegion: Record<string, Record<string, string>> = {
      Spanish: {
        colombia: "b2htR0pMe28pYwCY9gnP", // Sofía (Colombia)
        mexico: "htFfPSZGJwjBv1CL0aMD", // Antonio (México)
        argentina: "p7AwDmKvTdoHTBuueGvP", // Malena (Argentina)
        peru: "JddqVF50ZSIR7SRbJE6u", // Valeria (LATAM)
        default: "JddqVF50ZSIR7SRbJE6u",
      },
      German: {
        germany: "Ww7Sq9tx9CCOiNOwWgsx", // Carl
        default: "K5ZVtkkBnuPY6YqXs70E",
      },
      English: {
        default: "21m00Tcm4TlvDq8ikWAM", // Rachel
      },
      Italian: {
        italy: "W71zT1VwIFFx3mMGH2uZ", // Marcotrox
        default: "gfKKsLN1k0oYYN9n2dXX", // Violetta
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
          text: plainText,
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
    const safeTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const filename = `${safeTitle}_${Date.now()}.mp3`;

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

    return { url, filename };
  } catch (err) {
    console.error("[elevenlabs] 💥 Failed to generate/upload audio:", err);
    return null;
  }
}
