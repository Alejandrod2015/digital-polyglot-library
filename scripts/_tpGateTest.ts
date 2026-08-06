// scripts/_tpGateTest.ts
//
// Checks for Talking Points. Run: npx tsx scripts/_tpGateTest.ts
//
//   1. The plan gate: who can open the section.
//   2. Vocabulary density: every written piece must sit in the journey band.
//   3. Surface forms: every vocab entry must actually occur in the body.
//
// (2) and (3) exist because both failed silently once. The pieces shipped at
// two entries per hundred words, a fifth of the journey figure, and an entry
// written as an infinitive ("apretar") never matched the conjugated form in
// the prose ("te aprieta"), so it highlighted nothing at all.

import {
  canAccessTalkingPoints,
  getEntries,
  missingVocabSurfaces,
  pieceWordCount,
  vocabDensity,
  VOCAB_DENSITY_MAX,
  VOCAB_DENSITY_MIN,
  VOCAB_PER_100_WORDS,
} from "@/lib/talkingPoints";
import type { Plan } from "@domain/access";

let failures = 0;

function check(ok: boolean, label: string, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  " + detail : ""}`);
}

// ---------- 1. plan gate ----------
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

// ---------- 2. densidad ----------
console.log(
  `\n== densidad de vocabulario (objetivo ${VOCAB_PER_100_WORDS} por 100, banda ${VOCAB_DENSITY_MIN}-${VOCAB_DENSITY_MAX}) ==`
);
const written = getEntries().filter((e) => e.piece.body.length > 0);
for (const { piece } of written) {
  const d = vocabDensity(piece);
  const words = pieceWordCount(piece);
  check(
    d >= VOCAB_DENSITY_MIN && d <= VOCAB_DENSITY_MAX,
    piece.title.slice(0, 42).padEnd(44),
    `${words} palabras, ${piece.vocab.length} entradas, ${d.toFixed(1)}/100`
  );
}

// ---------- 3. formas exactas ----------
console.log("\n== formas exactas en el texto ==");
for (const { piece } of written) {
  const missing = missingVocabSurfaces(piece);
  check(
    missing.length === 0,
    piece.title.slice(0, 42).padEnd(44),
    missing.length ? `no aparecen: ${missing.join(", ")}` : "todas aparecen"
  );
}

console.log(
  failures === 0
    ? `\nTODO OK (${written.length} piezas escritas)`
    : `\n${failures} FALLOS`
);
process.exit(failures === 0 ? 0 : 1);
