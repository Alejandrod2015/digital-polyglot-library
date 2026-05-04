/**
 * Regenerate vocab for the 2 new German A1 dialogue stories using the official
 * deterministic candidate extractor + base + extended filters. A sub-agent will
 * then write definitions for the surviving candidates (no LLM call from this
 * script; an external Agent run does the definitions phase via JSON files).
 *
 * Phase 1 (this script, --extract):
 *   For each story, extract candidates, filter, write the surviving list to
 *   data/vocab-rewrites/regenerate/<slug>-candidates.json.
 *
 * Phase 2 (manual / sub-agent):
 *   For each candidates file, an Agent writes a matching <slug>-vocab.json with
 *   { word, surface?, type?, definition }.
 *
 * Phase 3 (this script, --apply):
 *   For each story, load the vocab JSON, validate every definition against the
 *   official rules, and write back to DB.
 */

import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { extractDeterministicCandidates } from "../src/app/api/generate-vocab/route";
import { isLowValueStudyWord } from "../src/lib/vocabPedagogy";
import { isInvalidMultiwordVocab, normalizeToken } from "../src/lib/vocabSelection";

config({ path: ".env.local" });
config({ path: ".env" });

// SLUGS now reads from --slug= CLI arg; defaults to the two new A1 dialogues
// that originated this script. Pass --slug=cafe-in-kreuzberg etc. to retarget.
const DEFAULT_SLUGS = ["beim-baecker-am-hackeschen-markt", "tomaten-vom-wochenmarkt"];
function getSlugs(): string[] {
  const arg = process.argv.find((a) => a.startsWith("--slug="));
  if (arg) return arg.split("=")[1].split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_SLUGS;
}
const SLUGS = getSlugs();
const TARGET_LANGUAGE = "german";
const TARGET_LEVEL = "a1";
const TARGET_COUNT = 20;

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "data", "vocab-rewrites", "regenerate");

// Reuse extended filters from the audit/removal pipeline.
const EXTENDED_DISCOURAGED_GERMAN = new Set([
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
]);

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

// Extra A1 stopwords / honorifics / greetings that the deterministic extractor
// won't catch. The official pipeline filters these via an LLM selection pass;
// here we list them explicitly.
const GERMAN_A1_NOISE = new Set([
  // pronouns + auxiliaries already in stopwords but make sure
  "ich", "sie", "du", "er", "es", "wir", "ihr", "mich", "mir", "dich", "dir",
  "ihn", "ihm", "uns", "euch", "man", "sich", "selbst",
  // greetings + politeness
  "guten", "morgen", "abend", "tag", "nacht", "hallo", "tschüss", "danke",
  "bitte", "vielen", "schönen", "auf", "wiedersehen", "willkommen",
  "entschuldigung", "verzeihung", "ja", "nein", "gerne", "natürlich",
  // honorifics
  "herr", "frau", "fräulein", "doktor", "dr",
  // intensifiers / fillers common in dialogue
  "sehr", "zu", "alles", "etwas", "nichts", "doch", "mal", "ja", "ok",
  // common A1 words that aren't worth study slots
  "heute", "jetzt", "schon", "mehr", "wieder", "noch",
]);

function isCharacterName(word: string, storyText: string): boolean {
  // Extract speaker labels from dialogue: lines like "SpeakerName: ...".
  const trimmed = word.trim();
  if (trimmed.charAt(0) !== trimmed.charAt(0).toUpperCase()) return false;
  const labelMatches = storyText.match(/^[A-ZÄÖÜ][\wÄÖÜäöüß.'-]*(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß.'-]*){0,3}:/gmu) ?? [];
  const speakerNames = new Set(
    labelMatches
      .map((m) => m.replace(/:$/, "").trim().toLowerCase())
      .flatMap((s) => s.split(/\s+/))
  );
  return speakerNames.has(normalizeToken(word));
}

function isProperNoun(word: string, storyText: string = ""): boolean {
  if (!word) return false;
  const trimmed = word.trim();
  if (trimmed.charAt(0) !== trimmed.charAt(0).toUpperCase()) return false;
  const normalized = normalizeToken(word);
  if (GERMAN_PROPER_NOUNS.has(normalized)) return true;
  const tokens = word.toLowerCase().split(/\s+/);
  if (tokens.length > 1 && tokens.some((t) => GERMAN_PROPER_NOUNS.has(t.replace(/[^\p{L}]/gu, "")))) return true;
  if (storyText && isCharacterName(word, storyText)) return true;
  return false;
}

function isCompoundOfTransparent(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length < 8) return false;
  for (const t of EXTENDED_DISCOURAGED_GERMAN) {
    if (t.length >= 4 && w.includes(t)) {
      const remainder = w.replace(t, "");
      if (remainder.length >= 3) return true;
    }
  }
  return false;
}

function shouldKeep(word: string, type: string | undefined, storyText: string): boolean {
  const norm = normalizeToken(word);
  if (GERMAN_A1_NOISE.has(norm)) return false;
  if (EXTENDED_DISCOURAGED_GERMAN.has(norm)) return false;
  if (isProperNoun(word, storyText)) return false;
  if (isCompoundOfTransparent(word)) return false;
  if (isLowValueStudyWord({ word, language: "german", level: TARGET_LEVEL, cefrLevel: TARGET_LEVEL, type })) return false;
  if (isInvalidMultiwordVocab(word, { type, storyText })) return false;
  // Single-letter or very short words.
  if (norm.length <= 2) return false;
  return true;
}

// === validators for definition phase ===
const MULETILLAS: RegExp[] = [
  /^refers\s+to\b/i, /^describes?\b/i, /^used\s+(to|for|in|as|when)\b/i,
  /^means?\b/i, /^meaning\b/i, /^conveys?\b/i, /^speaks?\s+to\b/i,
  /^brings?\b/i, /^this\s+word\b/i, /^a\s+type\s+of\b/i, /^a\s+person\s+who\b/i,
  /^someone\s+who\b/i, /^something\s+that\b/i, /^the\s+(action|state|quality)\s+of\b/i,
];
const LEADING: RegExp[] = [
  /^[A-Za-z][A-Za-z'\-]*[;,:]/,
  /^[A-Za-z][A-Za-z'\-]*\s*\([^)]*\)\s*[;,:]/,
  /^(A|An|The|To)\s+[A-Za-z'\-]+[;,:]/i,
  /^(A|An|The|To)\s+[A-Za-z'\-]+\s*\([^)]*\)\s*[;,:]/i,
];
function wc(s: string) { return s.trim().split(/\s+/).filter(Boolean).length; }
function classifyDef(d: string): string[] {
  const r: string[] = [];
  if (MULETILLAS.some((re) => re.test(d.trim()))) r.push("muletilla");
  if (LEADING.some((re) => re.test(d.trim()))) r.push("leading-gloss");
  if (/—/.test(d)) r.push("em-dash");
  const w = wc(d);
  if (w > 16) r.push("too-long");
  if (w < 6) r.push("too-short");
  return r;
}

async function extractPhase() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const prisma = new PrismaClient();
  for (const slug of SLUGS) {
    const story = await prisma.journeyStory.findFirst({ where: { slug } });
    if (!story || !story.text) {
      console.warn(`Story ${slug} not found or has no text`);
      continue;
    }
    const cleanText = story.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const candidates = extractDeterministicCandidates(cleanText, TARGET_LANGUAGE, 200);
    const filtered = candidates.filter((c) => shouldKeep(c.word, c.typeHint, story.text!));
    // Hand a generous candidate pool to the sub-agent. It will pick the
    // strongest A1 study items, lemmatize surface forms (nehme → nehmen),
    // and write definitions. Mirrors what the LLM selection step does in
    // the official /api/generate-vocab pipeline.
    const top = filtered.slice(0, 50);
    // Tag each candidate with the third of the text where it first appears, so
    // the sub-agent can spread its picks across beginning / middle / end.
    const lowerText = cleanText.toLowerCase();
    const thirdSize = Math.floor(cleanText.length / 3);
    const thirdOf = (pos: number): "beginning" | "middle" | "end" => {
      if (pos < thirdSize) return "beginning";
      if (pos < thirdSize * 2) return "middle";
      return "end";
    };
    const out = {
      slug,
      storyId: story.id,
      title: story.title,
      level: story.level,
      topic: story.topic,
      storyText: cleanText,
      textLength: cleanText.length,
      thirds: { beginning: [0, thirdSize], middle: [thirdSize, thirdSize * 2], end: [thirdSize * 2, cleanText.length] },
      candidates: top.map((c) => {
        const pos = lowerText.indexOf(c.word.toLowerCase());
        return {
          word: c.word,
          type: c.typeHint ?? "other",
          score: c.score,
          firstPos: pos,
          third: pos >= 0 ? thirdOf(pos) : "unknown",
        };
      }),
    };
    const file = path.join(DIR, `${slug}-candidates.json`);
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`${slug}: ${candidates.length} candidates → ${filtered.length} after filter → top ${top.length} written to ${file}`);
    console.log(`  ${top.map((c) => c.word).join(", ")}`);
  }
  await prisma.$disconnect();
}

async function applyPhase() {
  const prisma = new PrismaClient();
  for (const slug of SLUGS) {
    const vocabFile = path.join(DIR, `${slug}-vocab.json`);
    if (!existsSync(vocabFile)) {
      console.warn(`No vocab file for ${slug} at ${vocabFile} — skipping`);
      continue;
    }
    const data = JSON.parse(readFileSync(vocabFile, "utf8")) as {
      vocab: { word: string; surface?: string; definition: string; type?: string }[];
    };
    if (!Array.isArray(data.vocab) || data.vocab.length === 0) {
      console.warn(`Vocab file for ${slug} is empty — skipping`);
      continue;
    }
    const fails: { word: string; reasons: string[]; w: number }[] = [];
    for (const v of data.vocab) {
      const r = classifyDef(v.definition);
      if (r.length > 0) fails.push({ word: v.word, reasons: r, w: wc(v.definition) });
    }
    if (fails.length > 0) {
      console.error(`${slug}: ${fails.length} defs failed validation, NOT applying:`);
      for (const f of fails) console.error(`  [${f.reasons.join(",")} ${f.w}w] ${f.word}: <see file>`);
      continue;
    }
    const story = await prisma.journeyStory.findFirst({ where: { slug } });
    if (!story) { console.warn(`${slug}: not found in DB`); continue; }
    await prisma.journeyStory.update({
      where: { id: story.id },
      data: { vocab: data.vocab as any, vocabCount: data.vocab.length },
    });
    console.log(`${slug}: applied ${data.vocab.length} vocab items`);
  }
  await prisma.$disconnect();
}

async function run() {
  if (process.argv.includes("--extract")) await extractPhase();
  else if (process.argv.includes("--apply")) await applyPhase();
  else { console.error("Pass --extract or --apply"); process.exit(1); }
}

run().catch((err) => { console.error(err); process.exit(1); });
