/**
 * One-off CLI to generate a cover image for a JourneyStory and persist it
 * to R2 + DB (sets coverUrl + coverDone=true). Mirrors what
 * /api/studio/journeys/cover does, but invoked directly without going
 * through Studio auth.
 *
 * Defaults: variant=earthy-cartoon, provider=flux (catalog standard, see
 * project_cover_defaults memory).
 *
 * Usage: tsx scripts/generateStoryCover.ts <storyId>
 *          [--variant=earthy-cartoon|cool-cartoon|warm-cartoon]
 *          [--provider=flux|openai|gemini-imagen-4|gemini-imagen-4-ultra|gemini-flash-image|gemini-3-pro-image]
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
    console.error("Usage: tsx scripts/generateStoryCover.ts <storyId> [--variant=...] [--provider=...]");
    process.exit(2);
  }
  const providerArg = process.argv.find((a) => a.startsWith("--provider="))?.split("=")[1];
  const variantArg = process.argv.find((a) => a.startsWith("--variant="))?.split("=")[1];

  const provider: CoverProvider = providerArg && (COVER_PROVIDERS as readonly string[]).includes(providerArg)
    ? (providerArg as CoverProvider)
    : "flux";
  const variant: CoverVariant = variantArg && (COVER_VARIANTS as readonly string[]).includes(variantArg)
    ? (variantArg as CoverVariant)
    : "earthy-cartoon";

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story not found: ${storyId}`);

  const synopsis = stripHtmlForCover(story.synopsis || story.text || "").slice(0, 1600);
  if (!synopsis) throw new Error("story needs text or synopsis before generating cover");

  const prompt = buildCoverPrompt({
    title: story.title || "",
    synopsis,
    language: story.journey.language,
    region: story.journey.variant,
    topic: story.topic,
    level: story.level,
    variant,
  });
  const fileBase = sanitizeFileChunk(story.title || "story-cover");
  const filename = `${fileBase || "story-cover"}-${variant}-${provider}-${Date.now()}.png`;

  console.log(`Story: ${story.title} (${storyId})`);
  console.log(`Variant: ${variant}`);
  console.log(`Provider: ${provider}`);

  async function generate(): Promise<Buffer> {
    switch (provider) {
      case "flux": return generateFluxImageBuffer(prompt);
      case "openai": return Buffer.from(await generateOpenAIImageBase64(prompt), "base64");
      case "gemini-imagen-4": return generateGeminiImagen4Buffer(prompt);
      case "gemini-imagen-4-ultra": return generateGeminiImagen4Buffer(prompt, "imagen-4.0-ultra-generate-001");
      case "gemini-flash-image": return generateGeminiFlashImageBuffer(prompt);
      case "gemini-3-pro-image": return generateGeminiFlashImageBuffer(prompt, "gemini-3-pro-image-preview");
    }
  }

  const buffer = await generate();
  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });
  if (!uploaded?.url) throw new Error("Failed to upload cover image");

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { coverUrl: uploaded.url, coverDone: true },
  });

  console.log(`Uploaded: ${uploaded.url}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
