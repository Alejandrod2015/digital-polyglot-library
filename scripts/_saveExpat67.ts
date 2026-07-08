/**
 * Save + publish expat topics 6-7 into their slots (journey cmr92f0qz, C1).
 * Reads validated JSON from /tmp/expat67, writes content and sets status
 * published with a hand-written slug (umlauts -> ae/oe/ue, ß -> ss) so the
 * broken-diacritic auto-slug never ships.  Usage: tsx scripts/_saveExpat67.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync, readdirSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmr92f0qz000032ff1dfd4fgx";
const DIR = process.argv[2] || "/tmp/expat67";

const SLUGS: Record<string, string> = {
  "Ein Antrag auf Freizeit": "ein-antrag-auf-freizeit",
  "Wir müssen mal": "wir-muessen-mal",
  "Blumen gießen ist Vertrauenssache": "blumen-giessen-ist-vertrauenssache",
  "Gute Besserung im Oktober": "gute-besserung-im-oktober",
  "Zwei Meinungen zu einem Rücken": "zwei-meinungen-zu-einem-ruecken",
  "Die mit der Thermoskanne": "die-mit-der-thermoskanne",
};

(async () => {
  const prisma = new PrismaClient();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const d = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
    const slug = SLUGS[d.title];
    if (!slug) { console.error(`  NO slug for "${d.title}"`); continue; }
    const slot = await prisma.journeyStory.findFirst({
      where: { journeyId: JOURNEY_ID, topic: d.topic, slotIndex: d.slotIndex },
      select: { id: true },
    });
    if (!slot) { console.error(`  no slot ${d.topic}#${d.slotIndex}`); continue; }
    const wordCount = (d.text as string).trim().split(/\s+/).length;
    const r = await prisma.journeyStory.update({
      where: { id: slot.id },
      data: {
        title: d.title, slug, synopsis: d.synopsis, text: d.text, vocab: d.vocab,
        arcType: d.arcType, wordCount, vocabCount: d.vocab.length, status: "published",
      },
      select: { status: true, slug: true, topic: true, slotIndex: true, wordCount: true, vocabCount: true },
    });
    console.log(`  ${r.status}  ${r.topic}#${r.slotIndex}  ${r.slug}  (${r.wordCount}w, ${r.vocabCount} vocab)`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
