/**
 * Fusiona las 25 reescrituras manuales (las que el auto-shortener no
 * pudo resolver) al output.json existente. Las definiciones manuales
 * están hardcodeadas acá; Claude las escribió a mano en sesión.
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { wordCount } from "../src/lib/vocabValidation";

const OUTPUT_PATH = path.join(
  path.resolve(__dirname, ".."),
  "data",
  "vocab-shorten",
  "output.json"
);

type DumpStory = {
  storyId: string;
  slug: string | null;
  title: string | null;
  language: string | null;
  longDefs: Array<{ word: string; definition: string; chars: number; words: number }>;
};

// (storyId, word) → new definition. Escritas a mano para los 25 casos
// que el heurístico no resolvió. Cumplen 3-7 palabras, ≤50 chars.
const MANUAL: Record<string, Record<string, string>> = {
  cmoni7j4f000032gnogvzmzb9: { Abschied: "Farewell; emotional goodbye" },
  cmogn9tbi0001l204gwm99b6c: { catturare: "To seize or represent essence" },
  cmogn9tbi0002l204wpc0e4dx: { ingrediente: "Cooking ingredient or component" },
  cmogli5yt0001l404jj9zsf1a: { ingrediente: "Cooking ingredient or component" },
  cmp5h7y0k000132427eiq5pu1: { Ofen: "Kitchen oven for baking" },
  cmo3i4jn1000m32y7wleyfgbo: { schien: "Seemed; appeared (past)" },
  cmownkmrd000132z52ezi2zww: {
    olla: "Large cooking pot",
    hondo: "Deep, of plates or bowls",
  },
  cmoncz14w0002ukucenj11v6i: { manchmal: "Sometimes; now and then" },
  cmoncz14w0004ukucuasqpua4: { manchmal: "Sometimes; now and then" },
  cmoy5e2ki000132jazq2s2d2m: {
    papel: "Paper for writing or notes",
    celular: "Mobile phone; cell phone",
    plato: "Plate; flat dish for food",
  },
  cmoy6jujd000132kndqhbwdb3: {
    colectivo: "City bus in Argentina",
    carpeta: "Folder for papers or documents",
    bandeja: "Flat tray for food",
  },
  cmoncz14x000gukuclg9q02mi: { Zange: "Tongs for picking up bread" },
  cmolrnlda000532s9ke3pqnyu: { forchetta: "Fork; pronged eating utensil" },
  cmoy7xnxh000132o9kf84seph: { sobre: "Envelope for letters or documents" },
  cmoy8xgw5000132isexgxekvd: {
    bandeja: "Flat tray for food",
    vidrio: "Glass for windows or displays",
    carpeta: "Folder for papers or documents",
    sobre: "Envelope for letters or documents",
  },
  cmor4lm70000132pk2oa13tkx: {
    Beere: "Berry; strawberry or blueberry",
    zurück: "Back; returning to a place",
  },
};

// Sobreescrituras adicionales: defs que el auto-shortener salvó pero
// quedaron cortadas raras (terminan en conector forzado, sin objeto).
// Las arreglo a mano para evitar el "A sort of", "Spoken pledge or".
const TOUCHUPS: Array<{ word: string; definition: string }> = [
  { word: "strano", definition: "Different or strange" },
  { word: "Versprechen", definition: "A spoken pledge" },
  { word: "eine Art", definition: "A kind or type" },
  { word: "trotzdem", definition: "Nevertheless; in spite of" },
  { word: "igual", definition: "The same; equal" },
  { word: "sono", definition: "Am, is, or are" },
  { word: "storia", definition: "A narrative of events" },
  { word: "siguiente", definition: "Next in order or time" },
  { word: "vorbeiziehen", definition: "To pass by or move past" },
  { word: "Tasche", definition: "A bag or pocket" },
  { word: "Kleinigkeit", definition: "A small matter or trifle" },
  { word: "despacio", definition: "Slowly; without rushing" },
  { word: "übermalen", definition: "To paint over an image" },
  { word: "applaudono", definition: "They applaud or clap" },
];

function run() {
  const raw = readFileSync(OUTPUT_PATH, "utf8");
  const output = JSON.parse(raw) as DumpStory[];
  const byId = new Map(output.map((s) => [s.storyId, s]));

  let added = 0;
  for (const [storyId, words] of Object.entries(MANUAL)) {
    let story = byId.get(storyId);
    if (!story) {
      story = {
        storyId,
        slug: null,
        title: null,
        language: null,
        longDefs: [],
      };
      output.push(story);
      byId.set(storyId, story);
    }
    for (const [word, definition] of Object.entries(words)) {
      // Si ya existe (improbable) la sobreescribimos.
      const idx = story.longDefs.findIndex((d) => d.word === word);
      const entry = {
        word,
        definition,
        chars: definition.length,
        words: wordCount(definition),
      };
      if (idx >= 0) story.longDefs[idx] = entry;
      else story.longDefs.push(entry);
      added += 1;
    }
  }

  // Apply touchups: sobreescribe en TODAS las stories cualquier
  // entrada cuya `word` coincida con un touchup. Útil cuando la misma
  // palabra aparece en múltiples stories y el auto-shortener la dejó
  // mal en varias (ej.: "Tasche" en 2 stories distintas).
  let touched = 0;
  for (const { word, definition } of TOUCHUPS) {
    for (const story of output) {
      const idx = story.longDefs.findIndex((d) => d.word === word);
      if (idx >= 0) {
        story.longDefs[idx] = {
          word,
          definition,
          chars: definition.length,
          words: wordCount(definition),
        };
        touched += 1;
      }
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[merge-manual] merged ${added} manual rewrites + ${touched} touchups into ${OUTPUT_PATH}`);
}

run();
