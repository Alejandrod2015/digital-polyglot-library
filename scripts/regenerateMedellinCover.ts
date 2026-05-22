/**
 * Regenera el cover de "El mercado de Medellín" (Colombian Spanish
 * Stories for Beginners) usando Flux 2 Pro + custom prompt bright
 * daylight per cover defaults. Bypassa `buildCoverPrompt` y escribe
 * el URL nuevo en `src/data/books/colombian-spanish-stories-for-beginners.ts`.
 *
 * Run: pnpm dlx tsx scripts/regenerateMedellinCover.ts
 */

import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";

config({ path: ".env.local" });
config({ path: ".env" });

const STORY_SLUG = "el-mercado-de-medellin";
const BOOK_PATH = resolve(
  __dirname,
  "../src/data/books/colombian-spanish-stories-for-beginners.ts"
);

// Custom prompt per cover defaults policy:
//   - 2 characters mid-shot (young traveler + warm vendor)
//   - Concrete action + setting + props
//   - Bright daylight palette (vivid Colombian colors, no sepia)
//   - Hand-drawn cartoon vector style à la Duolingo/Babbel
const PROMPT = [
  "A bustling Colombian market scene in bright daylight at the famous Mercado de Medellín.",
  "Two characters mid-shot:",
  "(1) a 25-year-old male traveler with a friendly smile, light brown skin, carrying a small backpack, holding a freshly cut tropical fruit and tasting it for the first time.",
  "(2) an older 60-year-old market vendor woman (Doña Carmen) wearing a warm patterned apron, gesturing with one hand toward her colorful stall of fresh herbs, baskets of guanábana, chontaduro, and lulo.",
  "Setting: covered open-air market in Medellín with corrugated metal roof letting in shafts of sunlight, stacked crates of vibrant tropical fruit (oranges, mangoes, papayas), hanging bunches of fresh herbs (ruda, cidrón), and a stack of fresh arepa de choclo in the foreground.",
  "Time of day: late morning, golden warm sunlight filtering through the metal roof.",
  "Style: Hand-drawn cartoon vector illustration in the style of contemporary editorial language-learning book covers (Duolingo, Babbel, Headspace, Notion). Clean rounded shapes, gentle line work, expressive but stylized faces.",
  "Palette: bright vivid Colombian colors — saturated turquoise, papaya orange, lime green, coral pink, sunshine yellow. NOT earthy sepia. NOT muted. Crisp, lively, alegre.",
  "Composition: 3:2 horizontal landscape, characters in middle ground, market produce filling foreground, slight bokeh on background market stalls.",
].join(" ");

async function main() {
  console.log(`Generating cover for "${STORY_SLUG}" via Flux 2 Pro...`);
  console.log(`Prompt length: ${PROMPT.length} chars`);

  const buffer = await generateFluxImageBuffer(PROMPT);
  console.log(`✓ Flux returned ${buffer.length} bytes`);

  const filename = `${STORY_SLUG}-flux-${Date.now()}.png`;
  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });
  if (!uploaded?.url) throw new Error("R2 upload failed (no url returned)");
  console.log(`✓ Uploaded to ${uploaded.url}`);

  // Update the catalog TS file: replace the "cover" field of the
  // matching story object with the new R2 URL.
  let raw = readFileSync(BOOK_PATH, "utf8");
  const storyAnchor = `"id": "${STORY_SLUG}"`;
  const idx = raw.indexOf(storyAnchor);
  if (idx < 0) throw new Error(`Story anchor not found: ${storyAnchor}`);
  // Find the next "cover" key within the story object boundaries (~5kb window)
  const window = raw.slice(idx, idx + 8000);
  const coverRe = /"cover":\s*"[^"]*"/;
  const match = window.match(coverRe);
  if (!match) throw new Error(`No "cover" field within story window`);
  const replaced = window.replace(coverRe, `"cover": "${uploaded.url}"`);
  raw = raw.slice(0, idx) + replaced + raw.slice(idx + 8000);
  writeFileSync(BOOK_PATH, raw);
  console.log(`✓ Updated ${BOOK_PATH}`);
  console.log(`\nNew cover URL: ${uploaded.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
