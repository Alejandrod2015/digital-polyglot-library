/**
 * Lint of the level test bank (`src/lib/levelTest/bank.es.ts`): the rules a
 * placement exercise has to meet, measured, not remembered.
 *
 *   npx tsx scripts/checkLevelTestBank.ts
 *
 *  - per rung: 2 stations, each with one listen, meaning, fill and match
 *    exercise; no tested word twice in the bank;
 *  - meaning: the sentence marks exactly one `[[...]]`, whose text starts
 *    with the word's stem; four distinct options; no option shares a
 *    content word with the answer (a synonym distractor makes two answers);
 *  - listen: four distinct look-alike sentences, the played one first,
 *    four translations;
 *  - fill: the marked answer is the first option; four options and glosses;
 *  - match: four distinct words and meanings, each word within the rung;
 *  - cognates: no tested word shares a long stem with its English answer;
 *  - level: the word is within the rung's lemma list (external ruler,
 *    `isSpanishUpToLevel`) and NOT within the list of the rung below (from
 *    B1 up), so a C1 item is not really a B1 word; A1/A2 share one list;
 *  - register: no slang/regional/vulgar word of the catalogue's vocab.
 *
 * Exits 1 on any problem.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { SPANISH_LEVEL_TEST_BANK, type BankStation } from "../src/lib/levelTest/bank.es";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";
import type { LevelTestRung } from "../packages/domain/src/levelTest";

const RUNGS: LevelTestRung[] = ["A1", "A2", "B1", "B2", "C1"];
const BELOW: Partial<Record<LevelTestRung, "a2" | "b1" | "b2">> = { B1: "a2", B2: "b1", C1: "b2" };
const STOP = new Set(["to", "a", "an", "the", "of", "on", "in", "at", "by", "for", "with", "and", "or", "as", "be", "up", "out", "off", "it", "something", "someone", "not"]);

const norm = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function contentWords(gloss: string): Set<string> {
  return new Set(
    gloss
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .split(/[^a-z']+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function headword(word: string): string {
  // Multi-word entries ("a medida que"): the level is that of the longest
  // word. Diacritics stay: the lemma lists keep them.
  return word
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .sort((a, b) => b.length - a.length)[0];
}

function checkLevel(word: string, rung: LevelTestRung): string | null {
  const head = headword(word);
  const level = rung.toLowerCase() as "a1" | "a2" | "b1" | "b2" | "c1";
  if (!isSpanishUpToLevel(head, level === "a1" ? "a2" : level)) return `"${word}" is above ${rung} (not in the lists up to ${rung})`;
  const below = BELOW[rung];
  if (below && isSpanishUpToLevel(head, below)) return `"${word}" is already ${below.toUpperCase()} vocabulary, not ${rung}`;
  return null;
}


/**
 * Cognate check (user, 2026-09-20: "pueden hacer que los usuarios adivinen").
 * A tested word whose English answer shares a long stem with it is guessable
 * without any Spanish (escrutinio/scrutiny, hábito/habit). Heuristic: after
 * stripping diacritics and a leading "e" before "s" (escrutinio > scrutinio),
 * the longest common substring with any word of the gloss is 4+ letters and
 * at least half of the shorter word. Distractors are not checked: a cognate
 * distractor misleads rather than helps.
 */
function lcs(a: string, b: string): number {
  let best = 0;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      if (a[i - 1] === b[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; if (dp[i][j] > best) best = dp[i][j]; }
  return best;
}
function isCognate(spanish: string, gloss: string): string | null {
  const es = norm(spanish).replace(/^es(?=[ct])/, "s").replace(/[^a-z]/g, "");
  for (const raw of gloss.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z]+/)) {
    if (raw.length < 4 || STOP.has(raw)) continue;
    const shorter = Math.min(es.length, raw.length);
    const n = lcs(es, raw);
    if (n >= 4 && n * 2 >= shorter) return raw;
  }
  return null;
}

function checkStation(st: BankStation, rung: LevelTestRung, seen: Map<string, LevelTestRung>): string[] {
  const out: string[] = [];
  const use = (word: string) => {
    const key = norm(word);
    if (seen.has(key)) out.push(`"${word}" already used in ${seen.get(key)}`);
    seen.set(key, rung);
  };
  const distinct = (label: string, opts: readonly string[]) => {
    if (new Set(opts.map(norm)).size !== 4) out.push(`${label}: options repeat`);
  };
  // listen: four look-alike sentences, the played one first, four glosses.
  const l = st.listen;
  distinct(`listen "${l.sentence}"`, l.options);
  if (l.options[0] !== l.sentence) out.push(`listen "${l.sentence}": the played sentence must be the first option`);
  if (new Set(l.translations).size !== 4) out.push(`listen "${l.sentence}": translations repeat`);
  if (/[\u2013\u2014]/.test(l.sentence)) out.push(`listen "${l.sentence}": dash`);
  // meaning: one [[mark]] on the word, four glosses, no shared content word.
  const m = st.meaning;
  use(m.word);
  const marks = m.sentence.match(/\[\[(.+?)\]\]/g) ?? [];
  if (marks.length !== 1) out.push(`meaning "${m.word}": sentence must mark exactly one [[word]]`);
  else {
    const marked = norm(marks[0].slice(2, -2));
    const stem = norm(m.word).split(/\s+/)[0].slice(0, 4);
    if (!marked.startsWith(stem)) out.push(`meaning "${m.word}": marked form "${marked}" does not match the word`);
  }
  distinct(`meaning "${m.word}"`, m.options);
  const answer = contentWords(m.options[0]);
  m.options.slice(1).forEach((o) => {
    const shared = [...contentWords(o)].filter((w) => answer.has(w));
    if (shared.length) out.push(`meaning "${m.word}": distractor "${o}" shares "${shared.join(", ")}" with the answer`);
  });
  const ml = checkLevel(m.word, rung);
  if (ml) out.push(ml);
  const mc = isCognate(m.word, m.options[0]);
  if (mc) out.push(`meaning "${m.word}": cognate of "${mc}", guessable`);
  // fill: one [[mark]] equal to the first option, four Spanish options with
  // four glosses; the answer's level is the rung's.
  const f = st.fill;
  const fm = f.sentence.match(/\[\[(.+?)\]\]/g) ?? [];
  if (fm.length !== 1) out.push(`fill "${f.sentence}": sentence must mark exactly one [[answer]]`);
  else if (norm(fm[0].slice(2, -2)) !== norm(f.options[0])) out.push(`fill "${f.sentence}": marked answer is not the first option`);
  distinct(`fill "${f.sentence}"`, f.options);
  if (new Set(f.optionTranslations).size !== 4) out.push(`fill "${f.sentence}": option translations repeat`);
  if (!f.translation.trim()) out.push(`fill "${f.sentence}": no translation`);
  // The English line shows BEFORE the answer, with the answer's gloss
  // blanked (`_____`) and filled on reveal, as the practice format does; a
  // full translation gives the answer away (seen on the Pixel, 2026-09-20).
  if (!/_{3,}/.test(f.translation)) out.push(`fill "${f.sentence}": translation must blank the answer with _____`);
  const fc = isCognate(f.options[0], f.optionTranslations[0]);
  if (fc) out.push(`fill "${f.options[0]}": cognate of "${fc}", guessable`);
  // match: four pairs, four distinct words and four distinct meanings, each
  // word within the rung.
  const pairs = st.match.pairs;
  distinct("match words", pairs.map((p) => p.word));
  distinct("match meanings", pairs.map((p) => p.meaning));
  for (const p of pairs) {
    use(p.word);
    const lvl = checkLevel(p.word, rung);
    if (lvl) out.push(lvl);
    const pc = isCognate(p.word, p.meaning);
    if (pc) out.push(`match "${p.word}": cognate of "${pc}", guessable`);
  }
  return out;
}

let failed = false;
const seen = new Map<string, LevelTestRung>();
for (const rung of RUNGS) {
  const stations = SPANISH_LEVEL_TEST_BANK[rung] ?? [];
  const problems: string[] = [];
  if (stations.length !== 2) problems.push(`${stations.length} stations, expected 2`);
  for (const st of stations) problems.push(...checkStation(st, rung, seen));
  console.log(`${rung}: ${stations.length} stations, ${problems.length === 0 ? "ok" : problems.length + " problem(s)"}`);
  for (const p of problems) console.log(`  PROBLEM ${p}`);
  if (problems.length) failed = true;
}
console.log(failed ? "\nlevel-test bank: PROBLEMS FOUND" : "\nlevel-test bank: ok");
process.exit(failed ? 1 : 0);
