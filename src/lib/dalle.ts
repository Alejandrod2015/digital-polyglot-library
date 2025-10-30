// /src/lib/dalle.ts
import OpenAI from "openai";
import { sanityWriteClient as writeClient } from "@/sanity";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export type CoverParams = {
  title: string;
  language: string;
  region?: string;
  topic: string;
  level: string;
  text: string;
};

export async function generateAndUploadCover({
  title,
  language,
  region,
  topic,
  level,
  text,
}: CoverParams): Promise<{ url: string; filename: string } | null> {
  try {
    const shortText = text.replace(/<[^>]+>/g, " ").slice(0, 400);

    const regionClause = region ? ` (${region})` : "";
    const prompt = `
Minimal flat illustration inspired by a story titled "${title}".
Language: ${language}${region ? `, region: ${region}` : ""}.
Topic: ${topic}. Level: ${level}.
Cool balanced colors (sky blues, greens, neutrals), matte texture, clean geometric shapes.
No text, no logos, no frame, no warm filter, no orange tint.
`;


    console.log("[dalle] 🎨 Generating cover for:", title);

        const result = (await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
    })) as unknown;

    const imageBase64 =
      typeof result === "object" &&
      result !== null &&
      Array.isArray((result as any).data) &&
      typeof (result as any).data[0]?.b64_json === "string"
        ? (result as any).data[0].b64_json
        : null;

    if (!imageBase64) {
      console.error("[dalle] ❌ No image data returned");
      return null;
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const safeTitle = title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const filename = `${safeTitle}_${Date.now()}.png`;

    console.log("[dalle] ⬆ Uploading image to Sanity...");

    const asset = await writeClient.assets.upload("image", buffer, {
      filename,
      contentType: "image/png",
    });

    if (!asset?._id) {
      console.error("[dalle] ❌ Sanity upload failed (no asset id)");
      return null;
    }

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const fileId = asset._id.replace("image-", "").replace("-png", "");
    const url = `https://cdn.sanity.io/images/${projectId}/${dataset}/${fileId}.png`;

    console.log("[dalle] ✅ Cover uploaded:", filename, "→", url);

    return { url, filename };
  } catch (err) {
    console.error("[dalle] 💥 Failed to generate/upload cover:", err);
    return null;
  }
}
