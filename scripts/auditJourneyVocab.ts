/**
 * Audit published JourneyStory vocab against the official-pipeline filters
 * plus an extended cognate/proper-noun heuristic. No LLM calls.
 *
 * Flags:
 *   - in DISCOURAGED_VOCAB_BY_LANGUAGE (basic cognates the prompt already lists)
 *   - extended transparent cognates (Latin/Greek roots shared with English/Spanish):
 *       Tomate, Idee, Appetit, Olivenöl, Brotsalat, Brandenburg, etc.
 *   - proper nouns: place names, multi-word capitalized phrases
 *   - low-value study words via isLowValueStudyWord (function words, core verbs at B1+)
 *   - multiword fragments that aren't real expressions
 *
 * Output: per-story report of vocab items that should be removed.
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { isLowValueStudyWord } from "../src/lib/vocabPedagogy";
import { isInvalidMultiwordVocab, normalizeToken } from "../src/lib/vocabSelection";

config({ path: ".env.local" });
config({ path: ".env" });

// === Extended discouraged sets (cognates + transparent compounds) ===

const EXTENDED_DISCOURAGED: Record<string, Set<string>> = {
  german: new Set([
    // basic transparent cognates
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
    // basic cognate adjectives covered by official set already (wichtig, normal, etc.)
    "wichtig", "normal", "allgemein", "sozial", "natürlich", "speziell", "lokal", "real",
    "persönlich", "international", "nationalist", "modern", "klassisch", "elegant",
    "fantastisch", "interessant", "intelligent", "elegant", "perfekt", "originell",
    "exotisch", "tropisch", "spektakulär", "identisch",
  ]),
  italian: new Set([
    // basic transparent cognates
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
    // adjectives
    "importante", "normale", "generale", "sociale", "naturale", "speciale", "popolare",
    "formale", "locale", "reale", "personale", "internazionale", "moderno", "classico",
    "elegante", "fantastico", "interessante", "intelligente", "perfetto", "originale",
    "esotico", "tropicale", "spettacolare", "identico",
  ]),
};

// === Proper noun lists ===

const GERMAN_PROPER_NOUNS = new Set([
  // German federal states + major cities
  "berlin", "bayern", "münchen", "munich", "hamburg", "köln", "cologne", "frankfurt",
  "stuttgart", "düsseldorf", "leipzig", "dresden", "hannover", "nürnberg", "bremen",
  "essen", "dortmund", "bonn", "karlsruhe", "wiesbaden", "mainz", "mannheim",
  "brandenburg", "sachsen", "thüringen", "hessen", "saarland", "rheinland", "pfalz",
  "württemberg", "schwaben", "schleswig", "holstein", "mecklenburg", "vorpommern",
  // Berlin districts
  "mitte", "kreuzberg", "neukölln", "neukoelln", "friedrichshain", "prenzlauer", "berg",
  "schöneberg", "schoeneberg", "wedding", "moabit", "spandau", "charlottenburg",
  "wilmersdorf", "tempelhof", "treptow", "köpenick", "marzahn", "lichtenberg",
  "pankow", "reinickendorf", "steglitz", "zehlendorf", "tiergarten",
  // landmarks
  "alexanderplatz", "potsdamerplatz", "hackeschen", "hackescher", "boxhagener",
  "kottbusser", "tor", "brandenburger", "wannsee", "schlachtensee", "spittelmarkt",
  "mehringdamm", "sonnenallee", "winterfeldtmarkt", "winterfeldt",
  "schlesisches", "schönefeld", "schoenefeld", "tegel", "spree", "havel",
  "mauerfall", "wende", "checkpoint",
  "glienicke", "glienicker", "brücke", // bridge name
  "harz", "brocken", // mountain
  "rhein", "donau", "elbe",
  // Holidays/cultural
  "karneval", "oktoberfest", "weihnachten",
  // Sports/teams
  "hertha", "bayern", "dortmund", "schalke",
]);

const ITALIAN_PROPER_NOUNS = new Set([
  // Cities + regions
  "milano", "milan", "roma", "rome", "napoli", "naples", "torino", "turin", "venezia",
  "venice", "firenze", "florence", "bologna", "genova", "genoa", "palermo", "catania",
  "trieste", "verona", "padova", "padua", "modena", "perugia", "siena", "pisa",
  "lombardia", "lombardy", "lazio", "campania", "sicilia", "sicily", "sardegna",
  "sardinia", "toscana", "tuscany", "veneto", "piemonte", "piedmont", "liguria",
  // Districts/landmarks
  "trastevere", "navigli", "sancosimato", "spaccanapoli", "ballarò", "ballaro",
  "quartieri", "spagnoli", "altopiano", "boxhagener",
  "tevere", "po", "arno",
  "lupa", "capitolina", "colosseo", "vaticano", "duomo",
]);

// === per-word filters ===

type FlagReason =
  | "discouraged-base"
  | "discouraged-extended"
  | "proper-noun"
  | "low-value"
  | "invalid-multiword"
  | "compound-of-transparent";

function isProperNoun(word: string, language: string): boolean {
  if (!word) return false;
  const trimmed = word.trim();
  // Verbs and adjectives are lowercase in the dictionary form; they cannot be
  // proper nouns even if their lowercase form happens to be a city name (e.g.
  // "essen" the verb vs "Essen" the city).
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
  // Detect German compound: try splitting at any internal capital or known suffix.
  // Simple heuristic: if any 4+-char substring matches an extended-discouraged item
  // and another 4+-char substring is a known basic word, flag.
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

function classify(
  word: string,
  language: string,
  level: string,
  type: string | undefined,
  storyText: string
): FlagReason[] {
  const reasons: FlagReason[] = [];
  const set = EXTENDED_DISCOURAGED[language];
  if (set?.has(normalizeToken(word))) reasons.push("discouraged-extended");
  if (isProperNoun(word, language)) reasons.push("proper-noun");
  if (isLowValueStudyWord({ word, language, level, cefrLevel: level, type })) reasons.push("low-value");
  if (isInvalidMultiwordVocab(word, { type, storyText })) reasons.push("invalid-multiword");
  if (isCompoundOfTransparent(word, language)) reasons.push("compound-of-transparent");
  return reasons;
}

// === main ===

async function run() {
  const prisma = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { status: "published" },
    include: { journey: { select: { language: true } } },
    orderBy: [{ journey: { language: "asc" } }, { level: "asc" }, { slug: "asc" }],
  });

  let totalDefs = 0;
  let totalFlagged = 0;
  const reasonCounts: Record<FlagReason, number> = {
    "discouraged-base": 0,
    "discouraged-extended": 0,
    "proper-noun": 0,
    "low-value": 0,
    "invalid-multiword": 0,
    "compound-of-transparent": 0,
  };

  for (const story of stories) {
    if (!Array.isArray(story.vocab)) continue;
    const vocab = story.vocab as unknown as { word: string; type?: string }[];
    const flagged: { word: string; reasons: FlagReason[] }[] = [];
    for (const v of vocab) {
      totalDefs += 1;
      const r = classify(v.word, story.journey.language, story.level, v.type, story.text ?? "");
      if (r.length > 0) {
        flagged.push({ word: v.word, reasons: r });
        totalFlagged += 1;
        for (const x of r) reasonCounts[x] += 1;
      }
    }
    if (flagged.length === 0) continue;
    console.log(`\n${story.journey.language}/${story.level} ${story.slug} (${flagged.length}/${vocab.length} flagged):`);
    for (const f of flagged) {
      console.log(`  - ${f.word} [${f.reasons.join(",")}]`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total defs: ${totalDefs}, flagged: ${totalFlagged}`);
  console.log(`Reasons:`, reasonCounts);

  await prisma.$disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
