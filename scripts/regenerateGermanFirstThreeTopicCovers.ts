/**
 * Regenerate covers for every published story in the first 3 topics of the
 * German Conversacional journey using the validated cool-cartoon prompt
 * (Storyset/Freepik aesthetic) via gemini-3-pro-image-preview.
 *
 * Strategy:
 *   1. Find the German Conversacional journey.
 *   2. Take the first 3 topic slugs from its `topics` array.
 *   3. Iterate published stories in those topics, sorted by (level, slot).
 *   4. For each story: build prompt → call Gemini 3 Pro Image → upload to R2
 *      → update JourneyStory.coverUrl + coverDone.
 *
 * Run: pnpm dlx tsx scripts/regenerateGermanFirstThreeTopicCovers.ts
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import {
  buildCoverPrompt,
  sanitizeFileChunk,
  stripHtmlForCover,
} from "../src/lib/coverGenerator";

config({ path: ".env.local" });
config({ path: ".env" });

const GEMINI_MODEL = "gemini-3-pro-image-preview";

async function generateCoverBuffer(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
    throw new Error(`Gemini ${GEMINI_MODEL} rejected (${response.status}): ${details.slice(0, 400)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini ${GEMINI_MODEL} blocked: ${payload.promptFeedback.blockReason}`);
  }
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
  }
  throw new Error(`Gemini ${GEMINI_MODEL} returned no inline image data.`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const journey = await prisma.journey.findFirst({
    where: {
      language: { equals: "german", mode: "insensitive" },
      name: { equals: "Conversacional", mode: "insensitive" },
    },
  });
  if (!journey) throw new Error("German Conversacional journey not found");
  const firstThree = journey.topics.slice(0, 3);
  console.log(`Journey: ${journey.id} ${journey.name} ${journey.language}/${journey.variant}`);
  console.log(`First 3 topics: ${firstThree.join(", ")}\n`);

  const stories = await prisma.journeyStory.findMany({
    where: {
      journeyId: journey.id,
      topic: { in: firstThree },
      status: "published",
    },
    orderBy: [{ topic: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
    select: {
      id: true,
      title: true,
      synopsis: true,
      text: true,
      topic: true,
      level: true,
      slotIndex: true,
    },
  });
  console.log(`Found ${stories.length} published stories. Generating covers serially...\n`);

  let okCount = 0;
  let failCount = 0;
  for (const story of stories) {
    const synopsis = stripHtmlForCover(story.synopsis || story.text || "").slice(0, 1600);
    if (!synopsis) {
      console.warn(`[skip] ${story.topic}/L${story.level}/slot${story.slotIndex} — empty synopsis`);
      continue;
    }
    const prompt = buildCoverPrompt({
      title: story.title || "",
      synopsis,
      language: journey.language,
      region: journey.variant,
      topic: story.topic,
      level: story.level,
      // variant defaults to cool-cartoon
    });
    const fileBase = sanitizeFileChunk(story.title || `${story.topic}-${story.level}-${story.slotIndex}`);
    const filename = `${fileBase || "story-cover"}-cool-cartoon-${Date.now()}.png`;
    const tag = `${story.topic}/L${story.level}/slot${story.slotIndex}`;
    try {
      console.log(`[start] ${tag} — ${story.title}`);
      const buffer = await generateCoverBuffer(prompt);
      const uploaded = await uploadPublicObject({
        key: `media/generated/images/${filename}`,
        body: buffer,
        contentType: "image/png",
      });
      if (!uploaded?.url) throw new Error("upload returned no url");
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { coverUrl: uploaded.url, coverDone: true },
        select: { id: true },
      });
      console.log(`[ok] ${tag} -> ${uploaded.url}`);
      okCount += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fail] ${tag}: ${message}`);
      failCount += 1;
    }
  }

  console.log(`\nDone. ok=${okCount} fail=${failCount} total=${stories.length}`);
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
