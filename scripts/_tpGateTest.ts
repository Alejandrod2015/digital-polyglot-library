// scripts/_tpGateTest.ts
//
// Checks for Talking Points. Run: npx tsx scripts/_tpGateTest.ts
//
//   1. Plan gate; who can open the section.
//   2. Vocabulary density; entries per 100 words, the journey figure.
//   3. Surface forms; every entry occurs in the body as written.
//   4. Type mix; not a list of nouns with a few verbs bolted on.
//   5. Spread; entries distributed across paragraphs, not front-loaded.
//   6. Photos; landscape enough for the reader band, licence usable.
//
// Every one of these exists because it failed silently first. The pieces
// shipped at two entries per hundred words, a fifth of the journey figure;
// an entry written as an infinitive ("apretar") never matched the conjugated
// form in the prose ("te aprieta") and so highlighted nothing; and two thirds
// of the list were nouns, which teaches labels rather than language.

import {
  canAccessTalkingPoints,
  getEntries,
  missingVocabSurfaces,
  pieceWordCount,
  vocabDensity,
  vocabPerParagraph,
  vocabTypeMix,
  VOCAB_DENSITY_MAX,
  VOCAB_DENSITY_MIN,
  VOCAB_MAX_NOUN_SHARE,
  VOCAB_MAX_PARAGRAPH_SHARE,
  VOCAB_MIN_OTHER,
  VOCAB_MIN_VERB_SHARE,
  VOCAB_PER_100_WORDS,
} from "@/lib/talkingPoints";
import { isAllowedCommonsLicence, isLandscapeEnough, MIN_PHOTO_ASPECT } from "@/lib/wikimediaCommons";
import type { Plan } from "@domain/access";

let failures = 0;

function check(ok: boolean, label: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
}

const label = (s: string) => s.slice(0, 42).padEnd(44);

// ---------- 1. gate de plan ----------
console.log("\n== gate de plan ==");
const gateCases: Array<{
  plan: Plan;
  env: string;
  key?: string;
  expect: boolean;
  why: string;
}> = [
  { plan: "polyglot", env: "production", key: "pk_live_x", expect: true, why: "polyglot en prod           " },
  { plan: "owner", env: "production", key: "pk_live_x", expect: true, why: "owner en prod              " },
  { plan: "free", env: "production", key: "pk_live_x", expect: false, why: "free en prod               " },
  { plan: "basic", env: "production", key: "pk_live_x", expect: false, why: "basic en prod              " },
  { plan: "premium", env: "production", key: "pk_live_x", expect: false, why: "premium en prod            " },
  { plan: undefined, env: "production", key: "pk_live_x", expect: false, why: "sin plan en prod           " },
  { plan: "free", env: "development", key: "pk_test_x", expect: false, why: "dev CON clave (puerta off) " },
  { plan: "free", env: "development", expect: true, why: "dev SIN clave (puerta on)  " },
  { plan: "free", env: "production", expect: false, why: "prod sin clave             " },
];
for (const c of gateCases) {
  (process.env as Record<string, string>).NODE_ENV = c.env;
  if (c.key === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = c.key;
  check(canAccessTalkingPoints(c.plan) === c.expect, c.why);
}

const written = getEntries().filter((e) => e.piece.body.length > 0);

// ---------- 2. densidad ----------
console.log(
  `\n== densidad (objetivo ${VOCAB_PER_100_WORDS}/100, banda ${VOCAB_DENSITY_MIN}-${VOCAB_DENSITY_MAX}) ==`
);
for (const { piece } of written) {
  const d = vocabDensity(piece);
  check(
    d >= VOCAB_DENSITY_MIN && d <= VOCAB_DENSITY_MAX,
    label(piece.title),
    `${pieceWordCount(piece)} palabras, ${piece.vocab.length} entradas, ${d.toFixed(1)}/100`
  );
}

// ---------- 3. formas exactas ----------
console.log("\n== formas exactas en el texto ==");
for (const { piece } of written) {
  const missing = missingVocabSurfaces(piece);
  check(
    missing.length === 0,
    label(piece.title),
    missing.length ? `no aparecen: ${missing.join(", ")}` : "todas aparecen"
  );
}

// ---------- 4. mezcla de tipos ----------
console.log(
  `\n== tipos (sustantivos <=${VOCAB_MAX_NOUN_SHARE}%, verbos >=${VOCAB_MIN_VERB_SHARE}%, otros >=${VOCAB_MIN_OTHER}) ==`
);
for (const { piece } of written) {
  const mix = vocabTypeMix(piece);
  check(
    mix.nounShare <= VOCAB_MAX_NOUN_SHARE &&
      mix.verbShare >= VOCAB_MIN_VERB_SHARE &&
      mix.other >= VOCAB_MIN_OTHER,
    label(piece.title),
    `${mix.nounShare.toFixed(0)}% sust, ${mix.verbShare.toFixed(0)}% verbos, ${mix.other} otros`
  );
}

// ---------- 5. reparto por parrafo ----------
console.log(
  `\n== reparto (3-5 por parrafo, ninguno >${VOCAB_MAX_PARAGRAPH_SHARE}% del total) ==`
);
for (const { piece } of written) {
  const per = vocabPerParagraph(piece);
  const worst = Math.max(...per);
  check(
    per.every((n) => n >= 3 && n <= 5) &&
      (worst / piece.vocab.length) * 100 <= VOCAB_MAX_PARAGRAPH_SHARE,
    label(piece.title),
    per.join(" / ")
  );
}

// ---------- 6. fotos ----------
console.log(
  `\n== fotos (apaisadas >=${MIN_PHOTO_ASPECT}:1, licencia usable) ==`
);
for (const { piece } of written) {
  if (!piece.photo) {
    console.log(`      ${label(piece.title)}  sin foto`);
    continue;
  }
  const ratio = piece.photo.width / piece.photo.height;
  check(
    isLandscapeEnough(piece.photo) && isAllowedCommonsLicence(piece.photo.licence),
    label(piece.title),
    `${piece.photo.width}x${piece.photo.height} (${ratio.toFixed(2)}:1) ${piece.photo.licence}`
  );
}

console.log(
  failures === 0
    ? `\nTODO OK (${written.length} piezas escritas)`
    : `\n${failures} FALLOS`
);
process.exit(failures === 0 ? 0 : 1);
