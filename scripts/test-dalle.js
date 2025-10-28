// /scripts/test-dalle.js
import fs from "fs";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  try {
    console.log("🎨 Testing DALL·E cover generation...");

    const prompt = `
Minimal flat vector art inspired by "The Journey to Bavaria".
Cool balanced colors (sky blues, greens, neutrals), matte texture, clean geometric shapes.
No text, no logos, no frame, no warm filter, no orange tint.
`;




    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
    });

    const imageBase64 =
      result.data?.[0]?.b64_json ??
      (Array.isArray(result.data) ? result.data[0].b64_json : null);

    if (!imageBase64) throw new Error("No image data returned.");

    const buffer = Buffer.from(imageBase64, "base64");
    fs.writeFileSync("./dalle-test.png", buffer);

    console.log("✅ Image saved as dalle-test.png");
  } catch (err) {
    console.error("💥 Failed:", err);
  }
}

main();
