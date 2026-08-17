/**
 * Saves one Traveler-ES-Spain story JSON into its slot (by topic + slotIndex).
 * Reusable for all 21. Usage: npx tsx scripts/_saveSpainStory.ts <path-to-json>
 * JSON shape: { topic, slotIndex, title, synopsis, text, arcType, vocab:[{word,surface?,type,definition}] }
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmqc6tojm000032el2ebwsgkn";

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function run() {
  const path = process.argv[2];
  if (!path) { console.error("usage: _saveSpainStory.ts <json>"); process.exit(2); }
  const data = JSON.parse(readFileSync(path, "utf8"));
  const prisma = new PrismaClient();

  const slot = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY_ID, topic: data.topic, slotIndex: data.slotIndex },
    select: { id: true },
  });
  if (!slot) { console.error(`no slot for ${data.topic}#${data.slotIndex}`); process.exit(1); }

  const wordCount = (data.text as string).trim().split(/\s+/).length;
  const vocabCount = Array.isArray(data.vocab) ? data.vocab.length : 0;

  // Validate every vocab surface appears in body
  const bodyLower = (data.text as string).toLowerCase();
  const missing = (data.vocab as any[]).filter((v) => {
    const probe = (v.surface ?? v.word).toLowerCase();
    return !bodyLower.includes(probe);
  });
  if (missing.length) {
    console.error(`VOCAB NOT IN BODY: ${missing.map((m) => m.surface ?? m.word).join(", ")}`);
    process.exit(1);
  }

  await prisma.journeyStory.update({
    where: { id: slot.id },
    data: {
      title: data.title, slug: slugify(data.title), synopsis: data.synopsis,
      text: data.text, vocab: data.vocab, arcType: data.arcType,
      wordCount, vocabCount, status: "generated",
    },
  });
  console.log(`SAVED ${data.topic}#${data.slotIndex}: "${data.title}" (${wordCount}w, ${vocabCount} vocab)`);
  await prisma.$disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
