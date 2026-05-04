/**
 * Iterative testbed for cover-illustration prompts. Calls Gemini 3 Pro Image
 * directly (no Studio plumbing), generates 3 takes of the chosen cartoon
 * style for Beim Bäcker, uploads them to R2, prints public URLs.
 *
 * Style: Storyset/Freepik flat cartoon — stylized rounded faces, large almond
 * eyes, soft gradient skin shading, cel-shaded clothing, friendly approachable
 * expressions. The 3 takes are independent generations of the SAME prompt so
 * we can compare model variance.
 *
 * Run: pnpm dlx tsx scripts/testCoverPrompt.ts
 */

import { config } from "dotenv";
import { uploadPublicObject } from "../src/lib/objectStorage";

config({ path: ".env.local" });
config({ path: ".env" });

const SHARED_STYLE = [
  "Modern flat cartoon character illustration in the Storyset / Freepik educational-app aesthetic.",
  "Stylized rounded faces with large expressive almond-shaped eyes,",
  "soft gradient skin shading, simplified cel-shaded clothing, smooth clean linework, friendly approachable expressions.",
  "Same family of illustrations used by Duolingo, Notion, Headspace and Babbel landing pages.",
].join(" ");

// Two intensity tiers above pastel. Both keep the cool sage/lavender/blue
// harmony from take-1 but push saturation: intensity-A is vivid-confident,
// intensity-B is bold storybook-rich.
type Intensity = "intensity-A" | "intensity-B";

const PALETTE_BY_INTENSITY: Record<Intensity, string> = {
  "intensity-A": [
    "Color tonality: cool harmony anchored on sage green, lavender and dusty blue,",
    "with vivid confident saturation, not pastel and not washed-out.",
    "Use as many colors as the scene needs across props, clothing and environment.",
  ].join(" "),
  "intensity-B": [
    "Color tonality: cool harmony anchored on sage green, lavender and dusty blue,",
    "pushed to bold storybook-rich saturation: deep sage, jewel-toned lavender, strong dusty blue, with warm accents on the bread and wood.",
    "Confident, almost illustrated-children's-book intensity. Never neon, never washed-out.",
    "Use as many colors as the scene needs across props, clothing and environment.",
  ].join(" "),
};

const SCENE = [
  "Interior of a small Berlin bakery on a Saturday morning.",
  "Two women are the unmistakable main subject of the composition, framed in a mid-shot from the chest up:",
  "a middle-aged female customer in a simple coat stands in front of a wooden counter,",
  "and a young female baker in an apron stands behind it, smiling and handing her a paper bag with a baguette poking out.",
  "Behind the baker, wooden shelves hold loaves of crusty bread and rows of small bread rolls.",
  "Soft morning light comes from a large storefront window on the side.",
  "The two characters fill most of the frame; the bakery interior is a clean, simple backdrop.",
].join(" ");

const COMPOSITION = [
  "The two human characters are the focal point, not the building or the bread.",
  "Mid-shot framing, faces clearly visible.",
  "Wide horizontal 16:9 landscape frame.",
  "No text, no letters, no captions, no logos, no borders.",
].join(" ");

function buildPrompt(intensity: Intensity): string {
  return [SCENE, SHARED_STYLE, PALETTE_BY_INTENSITY[intensity], COMPOSITION].join(" ");
}

async function generateGemini3Pro(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = "gemini-3-pro-image-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: "Generate a horizontal 16:9 landscape cover illustration. " + prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini 3 Pro Image rejected (${response.status}): ${details.slice(0, 400)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini 3 Pro Image blocked: ${payload.promptFeedback.blockReason}`);
  }
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
  }
  throw new Error("Gemini 3 Pro Image returned no inline image data.");
}

async function main(): Promise<void> {
  const intensities: Intensity[] = ["intensity-A", "intensity-B"];
  const stamp = Date.now();
  console.log("Generating 2 cartoon variants at different saturation intensities for Beim Bäcker...\n");

  const tasks = intensities.map(async (intensity) => {
    const prompt = buildPrompt(intensity);
    console.log(`[${intensity}] requesting...`);
    try {
      const buffer = await generateGemini3Pro(prompt);
      const filename = `beim-baecker-cartoon-${intensity}-${stamp}.png`;
      const uploaded = await uploadPublicObject({
        key: `media/generated/images/${filename}`,
        body: buffer,
        contentType: "image/png",
      });
      const url = uploaded?.url ?? null;
      console.log(`[${intensity}] uploaded -> ${url}`);
      return { intensity, url, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${intensity}] failed: ${message}`);
      return { intensity, url: null, error: message };
    }
  });

  const results = await Promise.all(tasks);
  console.log("\n=== RESULTS ===");
  for (const r of results) {
    if (r.url) console.log(`${r.intensity}: ${r.url}`);
    else console.log(`${r.intensity}: FAILED -> ${r.error}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
