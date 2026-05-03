#!/usr/bin/env node
/**
 * One-off: hand-curated vocab for the rewritten Café in Kreuzberg story.
 * Used because the OpenAI quota was exhausted; this avoids the LLM path
 * entirely. All `surface` values appear verbatim in JourneyStory.text so
 * the reader's case-insensitive word-boundary regex matches every entry.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "../../src/generated/prisma/index.js";

const STORY_TITLE = "Café in Kreuzberg";

const VOCAB = [
  { word: "gemütlich",     surface: "gemütlich",     type: "adjective", definition: "Describes a cozy, warm, pleasant atmosphere; one of the most characteristic German cultural words." },
  { word: "Zeitung",       surface: "Zeitung",       type: "noun",      definition: "A newspaper (f); eine Zeitung lesen — to read a newspaper, an everyday café activity." },
  { word: "frei",          surface: "frei",          type: "adjective", definition: "Free or unoccupied; ist hier frei is the standard polite way to ask if a seat is taken." },
  { word: "besetzt",       surface: "besetzt",       type: "adjective", definition: "Taken or occupied; opposite of frei, used for tables, seats, phones." },
  { word: "Fenster",       surface: "Fenster",       type: "noun",      definition: "A window (n); am Fenster — by the window, a common café setting." },
  { word: "Buch",          surface: "Buch",          type: "noun",      definition: "A book (n); ein Buch lesen — to read a book." },
  { word: "Gesellschaft",  surface: "Gesellschaft",  type: "noun",      definition: "Company or society (f); here it means social company, someone to share time with." },
  { word: "wunderbar",     surface: "wunderbar",     type: "adjective", definition: "Wonderful, marvelous; a strong, warm positive descriptor for places and experiences." },
  { word: "Familie",       surface: "Familie",       type: "noun",      definition: "Family (f); meine Familie — my family, a core word for introductions." },
  { word: "Woche",         surface: "Woche",         type: "noun",      definition: "A week (f); seit einer Woche — for one week, takes the dative case." },
  { word: "schwierig",     surface: "schwierig",     type: "adjective", definition: "Difficult, hard; etwas ist schwierig — something is difficult, common across registers." },
  { word: "arbeiten",      surface: "arbeite",       type: "verb",      definition: "To work; ich arbeite in einer Buchhandlung — I work at a bookstore. Basic A1 verb." },
  { word: "Buchhandlung",  surface: "Buchhandlung",  type: "noun",      definition: "A bookstore (f); compound noun — Buch (book) + Handlung (trade), where books are sold." },
  { word: "verkaufen",     surface: "verkaufen",     type: "verb",      definition: "To sell; opposite of kaufen (to buy). Wir verkaufen Bücher — we sell books." },
  { word: "Studium",       surface: "Studium",       type: "noun",      definition: "University studies or degree program (n); mein Studium beginnt — my studies start." },
  { word: "Markt",         surface: "Markt",         type: "noun",      definition: "A market (m); zum Markt gehen — to go to the market, common on weekends in German cities." },
  { word: "frisch",        surface: "frisches",      type: "adjective", definition: "Fresh; frisches Brot — fresh bread, key adjective for food and produce." },
  { word: "Brot",          surface: "Brot",          type: "noun",      definition: "Bread (n); a German staple — every neighborhood has a Bäckerei selling Brot." },
  { word: "Käse",          surface: "Käse",          type: "noun",      definition: "Cheese (m); commonly bought at markets and grocery stores, breakfast staple." },
  { word: "mitkommen",     surface: "mitkommen",     type: "verb",      definition: "To come along (separable); möchtest du mitkommen? — do you want to come?" },
];

const prisma = new PrismaClient();

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { journey: { language: "german" }, title: STORY_TITLE },
    select: { id: true, text: true },
  });
  if (!story) throw new Error(`Story not found: ${STORY_TITLE}`);

  // Sanity-check: every surface must appear in the current story text. Stops
  // a stale vocab from making it to the DB if the text has drifted.
  const text = story.text ?? "";
  const missing = VOCAB.filter((v) => {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${v.surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\p{N}_])`, "iu");
    return !re.test(text);
  });
  if (missing.length) {
    console.error("⚠ Surfaces not found in story text:");
    missing.forEach((v) => console.error(`  - ${v.surface}`));
    throw new Error("Aborting — fix surfaces or text before applying vocab.");
  }

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: { vocab: VOCAB, vocabCount: VOCAB.length },
  });

  console.log(`✓ Wrote ${VOCAB.length} vocab items to "${STORY_TITLE}".`);
  VOCAB.forEach((v, i) =>
    console.log(`  ${(i + 1).toString().padStart(2)}. ${v.surface.padEnd(14)} (${v.type})`)
  );
}

main()
  .catch((err) => { console.error(err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
