/**
 * scripts/dumpStoryForFix.ts
 *
 * One-off helper: dumps a JourneyStory's current title/synopsis/text/vocab/arcType
 * into a JSON file shaped for `storyClaude.ts save`. Lets us patch just the vocab
 * (or other fields) by hand, then re-save without touching audio.
 *
 * Usage:
 *   tsx scripts/dumpStoryForFix.ts <storyId> <outputPath>
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const [, , storyId, outputPath] = process.argv;
  if (!storyId || !outputPath) {
    process.stderr.write("usage: dumpStoryForFix.ts <storyId> <outputPath>\n");
    process.exit(2);
  }
  const story = await prisma.journeyStory.findUnique({ where: { id: storyId } });
  if (!story) {
    process.stderr.write(`Story ${storyId} not found\n`);
    process.exit(1);
  }
  const payload = {
    title: story.title ?? "",
    synopsis: story.synopsis ?? "",
    text: story.text ?? "",
    vocab: story.vocab ?? [],
    arcType: story.arcType ?? undefined,
  };
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  process.stdout.write(JSON.stringify({
    storyId: story.id,
    slug: story.slug,
    status: story.status,
    arcType: story.arcType,
    wordCount: story.wordCount,
    vocabCount: story.vocabCount,
  }, null, 2));
}

main()
  .catch((e) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exit(1); })
  .finally(() => prisma.$disconnect());
