/**
 * Remove vocabulary items flagged by auditJourneyVocab from each published
 * JourneyStory's `vocab` array. Skips the 2 new German A1 dialogue stories
 * (beim-baecker-am-hackeschen-markt + tomaten-vom-wochenmarkt) which are
 * regenerated separately.
 *
 * Reuses the same classification logic from auditJourneyVocab.ts.
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { isLowValueStudyWord } from "../src/lib/vocabPedagogy";
import { isInvalidMultiwordVocab, normalizeToken } from "../src/lib/vocabSelection";

config({ path: ".env.local" });
config({ path: ".env" });

const SKIP_SLUGS = new Set([
  "beim-baecker-am-hackeschen-markt",
  "tomaten-vom-wochenmarkt",
]);

const EXTENDED_DISCOURAGED: Record<string, Set<string>> = {
  german: new Set([
    "tomate", "tomaten", "banane", "bananen", "orange", "orangen", "olive", "oliven",
    "salat", "kaffee", "tee", "pizza", "spaghetti", "salami", "parmesan", "mozzarella",
    "baguette", "sandwich", "chips", "cracker", "joghurt", "yoghurt",
    "idee", "ideen", "information", "kultur", "natur", "system", "methode", "theorie",
    "praxis", "logik", "physik", "chemie", "biologie", "mathematik", "musik", "film",
    "telefon", "computer", "internet", "email", "smartphone", "software",
    "kamera", "video", "foto", "radio", "hotel", "restaurant", "bus", "taxi", "auto",
    "park", "appetit", "panik", "energie", "minute", "sekunde", "meter", "zentimeter",
    "kilometer", "liter", "gramm", "kilogramm", "million", "milliarde", "prozent",
    "balkon", "garage", "elefant", "tiger", "kanguru", "panda", "zebra",
    "pasta", "lasagne", "tiramisu", "espresso", "cappuccino", "latte",
    "olivenöl", "tomatensauce", "tomatenmark", "knoblauch",
    "wichtig", "normal", "allgemein", "sozial", "natürlich", "speziell", "lokal", "real",
    "persönlich", "international", "nationalist", "modern", "klassisch", "elegant",
    "fantastisch", "interessant", "intelligent", "perfekt", "originell",
    "exotisch", "tropisch", "spektakulär", "identisch",
  ]),
  italian: new Set([
    "pomodoro", "pomodori", "banana", "arancia", "oliva", "olive",
    "insalata", "caffè", "caffe", "tè", "te", "pizza", "spaghetti", "salame", "parmesan",
    "parmigiano", "mozzarella", "baguette", "sandwich", "chips", "cracker", "yogurt",
    "idea", "idee", "informazione", "cultura", "natura", "sistema", "metodo", "teoria",
    "pratica", "logica", "fisica", "chimica", "biologia", "matematica", "musica", "film",
    "telefono", "computer", "internet", "email", "smartphone", "software",
    "telecamera", "macchina", "video", "foto", "radio", "hotel", "ristorante",
    "bus", "taxi", "auto", "parco", "appetito", "panico", "energia", "minuto",
    "secondo", "metro", "centimetro", "chilometro", "litro", "grammo", "chilogrammo",
    "milione", "miliardo", "percento",
    "elefante", "tigre", "panda", "zebra",
    "pasta", "lasagna", "lasagne", "tiramisu", "espresso", "cappuccino",
    "olio", "pomodorino",
    "importante", "normale", "generale", "sociale", "naturale", "speciale", "popolare",
    "formale", "locale", "reale", "personale", "internazionale", "moderno", "classico",
    "elegante", "fantastico", "interessante", "intelligente", "perfetto", "originale",
    "esotico", "tropicale", "spettacolare", "identico",
  ]),
};

const GERMAN_PROPER_NOUNS = new Set([
  "berlin", "bayern", "münchen", "hamburg", "köln", "frankfurt", "stuttgart",
  "düsseldorf", "leipzig", "dresden", "hannover", "nürnberg", "bremen", "essen",
  "dortmund", "bonn", "mannheim", "brandenburg", "sachsen", "thüringen", "hessen",
  "mitte", "kreuzberg", "neukölln", "neukoelln", "friedrichshain", "prenzlauer", "berg",
  "schöneberg", "schoeneberg", "wedding", "moabit", "spandau", "charlottenburg",
  "wilmersdorf", "tempelhof", "tiergarten",
  "alexanderplatz", "potsdamerplatz", "hackeschen", "hackescher", "boxhagener",
  "kottbusser", "tor", "brandenburger", "wannsee", "schlachtensee", "spittelmarkt",
  "mehringdamm", "sonnenallee", "winterfeldtmarkt", "winterfeldt",
  "schlesisches", "schönefeld", "schoenefeld", "tegel",
  "mauerfall", "wende", "checkpoint",
  "glienicke", "glienicker", "brücke",
  "harz", "brocken", "rhein", "donau", "elbe",
  "karneval", "oktoberfest", "weihnachten",
  "hertha", "schalke",
]);

const ITALIAN_PROPER_NOUNS = new Set([
  "milano", "roma", "napoli", "torino", "venezia", "firenze", "bologna", "genova",
  "palermo", "catania", "trieste", "verona", "padova", "modena", "perugia", "siena",
  "pisa", "lombardia", "lazio", "campania", "sicilia", "sardegna", "toscana", "veneto",
  "piemonte", "liguria",
  "trastevere", "navigli", "sancosimato", "spaccanapoli", "ballarò", "ballaro",
  "quartieri", "spagnoli", "altopiano",
  "tevere", "po", "arno", "lupa", "capitolina", "colosseo", "vaticano", "duomo",
]);

function isProperNoun(word: string, language: string): boolean {
  if (!word) return false;
  const trimmed = word.trim();
  if (trimmed.charAt(0) !== trimmed.charAt(0).toUpperCase()) return false;
  const normalized = normalizeToken(word);
  const tokens = word.toLowerCase().split(/\s+/);
  const set = language === "german" ? GERMAN_PROPER_NOUNS : ITALIAN_PROPER_NOUNS;
  if (!set) return false;
  if (set.has(normalized)) return true;
  if (tokens.length > 1 && tokens.some((t) => set.has(t.replace(/[^\p{L}]/gu, "")))) return true;
  return false;
}

function isCompoundOfTransparent(word: string, language: string): boolean {
  if (language !== "german") return false;
  const w = word.toLowerCase();
  if (w.length < 8) return false;
  const transparentSet = EXTENDED_DISCOURAGED.german;
  for (const t of transparentSet) {
    if (t.length >= 4 && w.includes(t)) {
      const remainder = w.replace(t, "");
      if (remainder.length >= 3) return true;
    }
  }
  return false;
}

function shouldRemove(
  word: string,
  language: string,
  level: string,
  type: string | undefined,
  storyText: string
): { remove: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (EXTENDED_DISCOURAGED[language]?.has(normalizeToken(word))) reasons.push("cognate");
  if (isProperNoun(word, language)) reasons.push("proper-noun");
  if (isLowValueStudyWord({ word, language, level, cefrLevel: level, type })) reasons.push("low-value");
  if (isCompoundOfTransparent(word, language)) reasons.push("compound");
  // NOTE: deliberately skip isInvalidMultiwordVocab — its A2+ false positives
  // (sich freuen, spazieren gehen, etc.) are valid pedagogical items.
  return { remove: reasons.length > 0, reasons };
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { status: "published" },
    include: { journey: { select: { language: true } } },
    orderBy: [{ journey: { language: "asc" } }, { level: "asc" }, { slug: "asc" }],
  });

  let totalUpdated = 0;
  let totalRemoved = 0;

  for (const story of stories) {
    if (story.slug && SKIP_SLUGS.has(story.slug)) continue;
    if (!Array.isArray(story.vocab)) continue;
    const vocab = story.vocab as unknown as { word: string; type?: string; surface?: string; definition: string }[];

    const kept: typeof vocab = [];
    const removed: { word: string; reasons: string[] }[] = [];
    for (const v of vocab) {
      const r = shouldRemove(v.word, story.journey.language, story.level, v.type, story.text ?? "");
      if (r.remove) removed.push({ word: v.word, reasons: r.reasons });
      else kept.push(v);
    }
    if (removed.length === 0) continue;

    console.log(`${story.journey.language}/${story.level} ${story.slug}: ${vocab.length} → ${kept.length} (removed ${removed.length})`);
    for (const r of removed) console.log(`  - ${r.word} [${r.reasons.join(",")}]`);

    if (apply) {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { vocab: kept as any, vocabCount: kept.length },
      });
      totalUpdated += 1;
    }
    totalRemoved += removed.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Stories updated: ${apply ? totalUpdated : "(dry-run)"}`);
  console.log(`Items removed: ${totalRemoved}`);
  console.log(`Skipped (regenerated separately): ${[...SKIP_SLUGS].join(", ")}`);

  await prisma.$disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
