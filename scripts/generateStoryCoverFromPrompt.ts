/**
 * One-off CLI to generate a cover image for a JourneyStory from a CUSTOM
 * hand-written prompt. Bypasses `buildCoverPrompt` per the story-quality
 * spec rule (line 142) and the `feedback_no_infantilized_covers` memory.
 *
 * Does NOT update the DB. Uploads to R2, prints the URL.
 *
 * Usage:
 *   tsx scripts/generateStoryCoverFromPrompt.ts <storyId> <prompt-file>
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { generateFluxImageBuffer, sanitizeFileChunk } from "../src/lib/coverGenerator";

async function main() {
  const storyId = process.argv[2];
  const promptFile = process.argv[3];
  if (!storyId || !promptFile) {
    console.error("Usage: tsx scripts/generateStoryCoverFromPrompt.ts <storyId> <prompt-file>");
    process.exit(2);
  }
  const prompt = readFileSync(promptFile, "utf-8").trim();
  if (!prompt) throw new Error(`Empty prompt file: ${promptFile}`);

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, title: true },
  });
  if (!story) throw new Error(`Story not found: ${storyId}`);

  const fileBase = sanitizeFileChunk(story.title || "story-cover");
  const filename = `${fileBase}-custom-flux-${Date.now()}.png`;

  console.log(`Story: ${story.title} (${storyId})`);
  const buffer = await generateFluxImageBuffer(prompt);
  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });
  if (!uploaded?.url) throw new Error("Failed to upload cover image");
  console.log(`URL: ${uploaded.url}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
