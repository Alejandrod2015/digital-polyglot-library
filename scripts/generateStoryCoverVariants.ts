/**
 * One-off CLI: generate the 3 cover variants (cool / warm / earthy cartoon)
 * for a JourneyStory using the same prompt and dispatch the same Studio UI
 * uses (/api/studio/journeys/cover-variants). Does NOT auto-pick — uploads
 * all three to R2 and prints the URLs so the user can choose.
 *
 * Default provider is `gemini-3-pro-image` because the cartoon prompt was
 * validated against gemini-3-pro-image-preview (see coverGenerator.ts:55).
 *
 * Usage: tsx scripts/generateStoryCoverVariants.ts <storyId> [--provider=gemini-3-pro-image|openai|flux|...]
 */
import { prisma } from "../src/lib/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import {
  buildCoverPrompt,
  COVER_PROVIDERS,
  COVER_VARIANTS,
  generateFluxImageBuffer,
  generateGeminiFlashImageBuffer,
  generateGeminiImagen4Buffer,
  generateOpenAIImageBase64,
  sanitizeFileChunk,
  stripHtmlForCover,
  type CoverProvider,
  type CoverVariant,
} from "../src/lib/coverGenerator";

async function main() {
  const storyId = process.argv[2];
  if (!storyId) {
    console.error("Usage: tsx scripts/generateStoryCoverVariants.ts <storyId> [--provider=...]");
    process.exit(2);
  }
  const providerArg = process.argv.find((a) => a.startsWith("--provider="))?.split("=")[1];
  const provider: CoverProvider = providerArg && (COVER_PROVIDERS as readonly string[]).includes(providerArg)
    ? (providerArg as CoverProvider)
    : "gemini-3-pro-image";

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story not found: ${storyId}`);
  const synopsis = stripHtmlForCover(story.synopsis || story.text || "").slice(0, 1600);
  if (!synopsis) throw new Error("story needs text or synopsis before generating cover");

  console.log(`Story: ${story.title} (${storyId})`);
  console.log(`Provider: ${provider}`);

  const fileBase = sanitizeFileChunk(story.title || "story-cover");

  async function generateBuffer(prompt: string): Promise<Buffer> {
    switch (provider) {
      case "flux": return generateFluxImageBuffer(prompt);
      case "openai": return Buffer.from(await generateOpenAIImageBase64(prompt), "base64");
      case "gemini-imagen-4": return generateGeminiImagen4Buffer(prompt);
      case "gemini-imagen-4-ultra": return generateGeminiImagen4Buffer(prompt, "imagen-4.0-ultra-generate-001");
      case "gemini-flash-image": return generateGeminiFlashImageBuffer(prompt);
      case "gemini-3-pro-image": return generateGeminiFlashImageBuffer(prompt, "gemini-3-pro-image-preview");
    }
  }

  const tasks = COVER_VARIANTS.map(async (variant: CoverVariant) => {
    try {
      const prompt = buildCoverPrompt({
        title: story.title || "",
        synopsis,
        language: story.journey.language,
        region: story.journey.variant,
        topic: story.topic,
        level: story.level,
        variant,
      });
      const filename = `${fileBase || "story-cover"}-${variant}-${provider}-${Date.now()}.png`;
      const buffer = await generateBuffer(prompt);
      const uploaded = await uploadPublicObject({
        key: `media/generated/images/${filename}`,
        body: buffer,
        contentType: "image/png",
      });
      if (!uploaded?.url) throw new Error("upload failed");
      return { variant, url: uploaded.url, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${variant}] failed: ${message}`);
      return { variant, url: null, error: message };
    }
  });

  const results = await Promise.all(tasks);
  console.log("\n=== Variants ===");
  for (const r of results) {
    if (r.url) console.log(`  ${r.variant.padEnd(16)} → ${r.url}`);
    else console.log(`  ${r.variant.padEnd(16)} → FAILED: ${r.error}`);
  }
  console.log("\nTo select one as the final cover:");
  console.log(`  tsx scripts/selectStoryCover.ts ${storyId} <url>`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
