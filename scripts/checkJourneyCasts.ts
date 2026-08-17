/**
 * PLANNING-TIME gate for the "every character is a native speaker" rule.
 *
 * The story gate (`body-non-native-character` in validateGeneratedStory) only
 * fires when a BODY is already written and saved. By then the journey has been
 * planned, the cast decided and often the voices cast. This script closes that
 * hole: it lints every `description` / `notes` string in
 * `src/lib/journeyCasts.ts` before a single story exists.
 *
 * WHY (2026-08-17): the root cause of the Friends ES/Spain A1 defect was not a
 * sentence, it was a PLAN. `GERMAN_EXPAT_B1_CAST` declares its protagonist as
 * "Expat de ~29 … alemán B1 real (se traba con el Amtsdeutsch, pide que le
 * repitan). Proxy del alumno." A brief that says "proxy del alumno" produces
 * 21 stories where the student's stand-in is a learner. The rule has to bite
 * where the decision is made, not three steps downstream.
 *
 * Reads the file as TEXT on purpose: importing journeyCasts drags
 * elevenlabs → prisma → server-only, and the text pass also covers casts that
 * are declared but not (yet) registered in JOURNEY_CASTS.
 *
 * Cast briefs are authored in Spanish whatever the journey language, so this
 * runs the validator's ES marker table plus a planning-specific list.
 *
 * Usage:  npx tsx scripts/checkJourneyCasts.ts
 * Exit 1 on any NEW violation. Known debt lives in KNOWN_PENDING and is
 * reported loudly without failing, so the user decides what to do with it.
 */
import * as fs from "fs";
import { findNonNativeMarkers } from "@/lib/validateGeneratedStory";

const CASTS_FILE = "src/lib/journeyCasts.ts";

/** Markers that only make sense in a BRIEF, not in a story body. */
const PLANNING_MARKERS: { re: RegExp; label: string }[] = [
  { re: /proxy del alumno|sustitut[oa] del alumno|representa al alumno|stand-in del alumno/iu, label: "el personaje se declara PROXY DEL ALUMNO" },
  { re: /(?<![\p{L}\p{M}])expat(?![\p{L}])|(?<![\p{L}\p{M}])expatriad[oa]/iu, label: "expat" },
  { re: /(?<![\p{L}\p{M}])no nativ[oa]|hablante no nativ/iu, label: "declarado no nativo" },
  { re: /(?:alem[aá]n|espa[nñ]ol|italiano|portugu[eé]s|franc[eé]s)\s+(?:A0|A1|A2|B1|B2|C1)(?![\p{L}])/iu, label: "se le asigna un NIVEL de idioma (solo tiene nivel quien aprende)" },
  { re: /se traba con|pide que le repitan|no entiende el idioma|le cuesta el idioma/iu, label: "fricción lingüística en el brief" },
  { re: /(?:aprende|estudia|practica)\s+(?:el\s+)?(?:alem[aá]n|espa[nñ]ol|italiano|portugu[eé]s|franc[eé]s)(?![\p{L}])/iu, label: "aprende el idioma del journey" },
  { re: /reci[eé]n llegad[oa] al pa[ií]s|llega al pa[ií]s|viene de otro pa[ií]s/iu, label: "llega de otro país" },
];

/**
 * Violations already in the catalogue, waiting on the user's decision.
 * Reported every run, never silently. Do NOT add entries here to make a NEW
 * plan pass: fix the plan instead (gold-standard calibration rule).
 */
const KNOWN_PENDING: Record<string, string> = {
  nadia:
    "Journey Expat DE (cmr92f0qz…, LIVE, 21 historias). La premisa entera es una extranjera en Alemania (Visum, Aufenthaltstitel). Diagnosticado 2026-08-17; el arreglo lo decide el usuario porque toca texto con audio ya generado.",
};

type Entry = { cast: string; slug: string; field: string; value: string; line: number };

/** Pull every description/notes string, tagged with its enclosing const + slug. */
function extractEntries(src: string): Entry[] {
  const lines = src.split("\n");
  const out: Entry[] = [];
  let cast = "(sin cast)";
  let slug = "(sin slug)";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const mCast = l.match(/^export const (\w+): JourneyCast/);
    if (mCast) { cast = mCast[1]; slug = "(sin slug)"; continue; }
    const mSlug = l.match(/^\s*slug:\s*"([^"]+)"/);
    if (mSlug) { slug = mSlug[1]; continue; }
    const mField = l.match(/^\s*(description|notes):\s*$/) ?? l.match(/^\s*(description|notes):\s*"/);
    if (!mField) continue;
    // The value may sit on this line or on the following ones until the
    // closing quote + comma. Join everything up to that point.
    let buf = l.slice(l.indexOf(mField[1]) + mField[1].length + 1);
    let j = i;
    while (!/",?\s*$/.test(buf.trim()) && j + 1 < lines.length && j - i < 12) {
      j++;
      buf += " " + lines[j].trim();
    }
    const value = buf.replace(/^\s*"?/, "").replace(/",?\s*$/, "").replace(/"\s*\+\s*"/g, "").trim();
    if (value) out.push({ cast, slug: mField[1] === "notes" ? `${slug} (notes)` : slug, field: mField[1], value, line: i + 1 });
    i = j;
  }
  return out;
}

function scan(text: string): string[] {
  const hits = findNonNativeMarkers(text, "ES");
  for (const { re, label } of PLANNING_MARKERS) {
    const m = text.match(re);
    if (m) hits.push(`${label} → "${m[0].trim()}"`);
  }
  return hits;
}

function run() {
  const src = fs.readFileSync(CASTS_FILE, "utf8");
  const entries = extractEntries(src);
  const fresh: string[] = [];
  const pending: string[] = [];

  for (const e of entries) {
    const hits = scan(e.value);
    if (!hits.length) continue;
    const bare = e.slug.replace(" (notes)", "");
    const known = KNOWN_PENDING[bare];
    const block = `${CASTS_FILE}:${e.line}  ${e.cast} → ${e.slug}\n     ${hits.join("\n     ")}${known ? `\n     PENDIENTE: ${known}` : ""}`;
    (known ? pending : fresh).push(block);
  }

  console.log(`Briefs de cast revisados: ${entries.length}`);
  if (pending.length) {
    console.log(`\n⚠︎  ${pending.length} violación(es) YA EN CATÁLOGO, pendientes de decisión del usuario:`);
    for (const p of pending) console.log(`   ${p}`);
  }
  if (fresh.length) {
    console.log(`\n✗  ${fresh.length} violación(es) NUEVA(S) de "todos los personajes son nativos":`);
    for (const v of fresh) console.log(`   ${v}`);
    console.log(
      `\nUn personaje del catálogo no puede ser extranjero ni aprendiz del idioma que enseña el\n` +
      `journey: lo que el alumno lee y oye es el MODELO. Replantea el cast para que sea nativo de\n` +
      `la región y lo que no sepa sean COSTUMBRES, nunca PALABRAS (molde Friends ES/Spain A0).\n` +
      `Nunca escribas al protagonista como sustituto del alumno.\n` +
      `Ver docs/story-quality-spec.md § "Todos los personajes son nativos de la región".`
    );
    process.exit(1);
  }
  console.log(`\n✓ Ningún cast NUEVO declara personajes no nativos ni aprendices.`);
}

run();
