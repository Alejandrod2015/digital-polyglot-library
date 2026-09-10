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
 *   tsx scripts/generateCover.ts <storyId> <scene-file> [--dry] [--set] [--catalog]
 *                                [--engine flux|gemini] [--ref <cast-sheet.png>] [--framing "<shot>"]
 *     --dry      print the composed prompt and exit (no model call, no cost)
 *     --set      after generating, write coverUrl (+ coverDone for journeys) to the DB
 *     --catalog  the id/slug refers to a CatalogStory (books) instead of a
 *                JourneyStory. Same locked style; only the lookup and the
 *                destination row change.
 *     --engine   flux (default) or gemini. gemini REQUIRES --ref.
 *     --ref      cast sheet (PNG/JPEG) sent to Gemini next to the text, so the
 *                three covers of a topic keep the same faces.
 *     --framing  the shot for this story (e.g. the entry in planos.json).
 *
 * Gemini prompt = LOCK + STYLE + FRAMING + SCENE (method "Reparto que no
 * cambia de cara"). STYLE is the locked styleBlock, never the doc's own style
 * line: the doc says "no gradients" and the lock says "soft gradients", and
 * the lock wins until the user approves a change.
 *
 * Env (script does not auto-load dotenv):
 *   NODE_OPTIONS="--conditions=react-server -r dotenv/config" \
 *   DOTENV_CONFIG_PATH=.env.local tsx scripts/generateCover.ts ...
 */
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { prisma } from "../src/lib/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import {
  generateFluxImageBuffer,
  generateGeminiFlashImageBuffer,
  sanitizeFileChunk,
  type GeminiReferenceImage,
} from "../src/lib/coverGenerator";

const STYLE_PATH = path.join(__dirname, "cover-style.json");

const LOCK =
  "The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone and clothing IDENTICAL to the sheet; only pose, framing, light and background change. Draw only the characters the scene names. No text, letters or numbers anywhere in the image.";

// The canvas line always goes; the per-story shot is appended when given.
const CANVAS = "FRAMING: 16:9 landscape, the illustration fills the whole canvas edge to edge, no white bands or borders.";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}

// Checks magic bytes so a wrong file (a WebP renamed to .png) fails here and
// not as an opaque 400 from the API.
function loadReferenceImage(filePath: string): GeminiReferenceImage {
  const data = readFileSync(filePath);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length >= 8 && data.subarray(0, 8).equals(png)) return { mimeType: "image/png", data };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { mimeType: "image/jpeg", data };
  }
  throw new Error(`--ref must be a PNG or JPEG: ${filePath}`);
}

async function main() {
  const storyId = process.argv[2];
  const sceneFile = process.argv[3];
  const dry = process.argv.includes("--dry");
  const set = process.argv.includes("--set");
  const catalog = process.argv.includes("--catalog");
  const engine = argValue("--engine") ?? "flux";
  const refPath = argValue("--ref");
  const rawFraming = argValue("--framing")?.trim().replace(/\.$/, "");
  const framing = rawFraming ? rawFraming[0].toUpperCase() + rawFraming.slice(1) : undefined;
  if (!storyId || !sceneFile) {
    console.error(
      "Usage: tsx scripts/generateCover.ts <storyId> <scene-file> [--dry] [--set] [--catalog] [--engine flux|gemini] [--ref <cast-sheet.png>] [--framing \"<shot>\"]"
    );
    process.exit(2);
  }
  if (engine !== "flux" && engine !== "gemini") throw new Error(`Unknown --engine: ${engine}`);
  if (engine === "gemini" && !refPath) throw new Error("--engine gemini requires --ref <cast-sheet.png>");
  if (engine === "flux" && refPath) throw new Error("--ref is only used with --engine gemini");

  const style = JSON.parse(readFileSync(STYLE_PATH, "utf-8"));
  const styleBlock: string = (style.styleBlock || "").trim();
  if (!styleBlock) throw new Error(`cover-style.json has no styleBlock`);

  const scene = readFileSync(sceneFile, "utf-8").trim();
  if (!scene) throw new Error(`Empty scene file: ${sceneFile}`);

  // Loaded before --dry so a bad sheet fails for free.
  const ref = refPath ? loadReferenceImage(refPath) : undefined;

  // Style ALWAYS leads; the scene is subordinate. With Gemini the LOCK leads
  // because it has to name the image before anything else is said.
  const prompt =
    engine === "gemini"
      ? [LOCK, styleBlock, framing ? `${CANVAS} ${framing}.` : CANVAS, `SCENE: ${scene}`].join("\n\n")
      : `${styleBlock}\n\nScene to depict in that exact style: ${scene}`;

  if (dry) {
    console.log(`--- STYLE: ${style.styleName} | ENGINE: ${engine} ---`);
    if (ref) console.log(`--- REF: ${refPath} (${ref.mimeType}, ${ref.data.length} bytes) ---`);
    console.log(prompt);
    return;
  }

  // Catalog stories (books) accept either the composite id (`bookId:slug`) or
  // the plain slug, since the slug is what an operator actually has at hand.
  const story = catalog
    ? await prisma.catalogStory.findFirst({
        where: { OR: [{ id: storyId }, { slug: storyId }] },
        select: { id: true, slug: true, title: true },
      })
    : await prisma.journeyStory.findUnique({
        where: { id: storyId },
        select: { id: true, slug: true, title: true },
      });
  if (!story) throw new Error(`Story not found: ${storyId}`);

  const fileBase = sanitizeFileChunk(story.title || "story-cover");
  const filename = `${fileBase}-styleB-${engine}-${Date.now()}.png`;

  console.log(`Story: ${story.title} (${storyId}) [${style.styleName}] engine=${engine}`);
  const buffer =
    engine === "gemini"
      ? await generateGeminiFlashImageBuffer(prompt, undefined, ref)
      : await generateFluxImageBuffer(prompt);
  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });
  if (!uploaded?.url) throw new Error("Failed to upload cover image");
  console.log(`URL: ${uploaded.url}`);

  if (set) {
    if (catalog) {
      // CatalogStory has no `coverDone` flag; `coverUrl` alone drives the reader.
      await prisma.catalogStory.update({
        where: { id: story.id },
        data: { coverUrl: uploaded.url },
      });
    } else {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { coverUrl: uploaded.url, coverDone: true },
      });
    }
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
