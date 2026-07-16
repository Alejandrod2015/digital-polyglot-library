/**
 * LOCKED cover generator. The ONLY sanctioned path to make a story cover.
 *
 * The style is NOT the model's choice: `scripts/cover-style.json.styleBlock`
 * is ALWAYS prepended. The caller supplies ONLY the scene (subject, place,
 * action) in a plain-text file. This makes it impossible to ship a cover in a
 * style that was not approved by the user.
 *
 * The pre-bash-guard hook blocks any other cover/Flux invocation, so drifting
 * back to a free-form prompt is refused at the shell.
 *
 * Usage:
 *   tsx scripts/generateCover.ts <storyId> <scene-file> [--dry] [--set]
 *     --dry  print the composed prompt and exit (no Flux call, no cost)
 *     --set  after generating, write coverUrl + coverDone=true to the DB
 *
 * Env (script does not auto-load dotenv):
 *   NODE_OPTIONS="--conditions=react-server -r dotenv/config" \
 *   DOTENV_CONFIG_PATH=.env.local tsx scripts/generateCover.ts ...
 */
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { generateFluxImageBuffer, sanitizeFileChunk } from "../src/lib/coverGenerator";

const STYLE_PATH = path.join(__dirname, "cover-style.json");

async function main() {
  const storyId = process.argv[2];
  const sceneFile = process.argv[3];
  const dry = process.argv.includes("--dry");
  const set = process.argv.includes("--set");
  if (!storyId || !sceneFile) {
    console.error("Usage: tsx scripts/generateCover.ts <storyId> <scene-file> [--dry] [--set]");
    process.exit(2);
  }

  const style = JSON.parse(readFileSync(STYLE_PATH, "utf-8"));
  const styleBlock: string = (style.styleBlock || "").trim();
  if (!styleBlock) throw new Error(`cover-style.json has no styleBlock`);

  const scene = readFileSync(sceneFile, "utf-8").trim();
  if (!scene) throw new Error(`Empty scene file: ${sceneFile}`);

  // Style ALWAYS leads; the scene is subordinate.
  const prompt = `${styleBlock}\n\nScene to depict in that exact style: ${scene}`;

  if (dry) {
    console.log(`--- STYLE: ${style.styleName} ---`);
    console.log(prompt);
    return;
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, title: true },
  });
  if (!story) throw new Error(`Story not found: ${storyId}`);

  const fileBase = sanitizeFileChunk(story.title || "story-cover");
  const filename = `${fileBase}-styleB-flux-${Date.now()}.png`;

  console.log(`Story: ${story.title} (${storyId}) [${style.styleName}]`);
  const buffer = await generateFluxImageBuffer(prompt);
  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });
  if (!uploaded?.url) throw new Error("Failed to upload cover image");
  console.log(`URL: ${uploaded.url}`);

  if (set) {
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { coverUrl: uploaded.url, coverDone: true },
    });
    console.log(`live: ${story.slug} coverUrl set`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
