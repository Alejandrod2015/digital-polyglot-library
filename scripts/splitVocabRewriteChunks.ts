import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data", "vocab-rewrites");
const INPUT_FILE = path.join(DATA_DIR, "input.json");
const CHUNK_DIR = path.join(DATA_DIR, "chunks");

const NUM_CHUNKS = 8;

const input = JSON.parse(readFileSync(INPUT_FILE, "utf8")) as {
  stories: unknown[];
};

if (!existsSync(CHUNK_DIR)) mkdirSync(CHUNK_DIR, { recursive: true });

const stories = input.stories;
const chunkSize = Math.ceil(stories.length / NUM_CHUNKS);

for (let i = 0; i < NUM_CHUNKS; i += 1) {
  const slice = stories.slice(i * chunkSize, (i + 1) * chunkSize);
  if (slice.length === 0) continue;
  const chunkFile = path.join(CHUNK_DIR, `chunk-${i}.json`);
  writeFileSync(chunkFile, JSON.stringify({ stories: slice }, null, 2));
  console.log(`chunk-${i}.json: ${slice.length} stories`);
}
