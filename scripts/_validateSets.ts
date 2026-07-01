/**
 * STRONG validator for curated practice sets (mole/humo template, 2026-07).
 *
 * This is the enforcement gate: `_seedAllSets.ts` imports `validateSet` and
 * REFUSES to seed a story whose JSON does not pass. It replaces the old
 * "exactly 10, 6/3/1" checker, which predated featured/pool, listen_choose,
 * translations and full-vocab coverage.
 *
 * Run standalone:  npx tsx scripts/_validateSets.ts [--only=<slug>]
 * Exit code != 0 when any file has issues (CI/pre-seed friendly).
 */
import * as fs from "fs";

const DIR = "scripts/_sets";
const AUTHORING = "scripts/_authoring.json";
const FEATURED_TARGET = 10;
const MEANING_MAX_WORDS = 14;
const FILL_MAX_WORDS = 12;
const ALLOWED_TYPES = new Set(["meaning_in_context", "fill_blank", "match_meaning", "listen_choose"]);

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// lemma/surface tolerant coverage: an exercise's target word "covers" a vocab
// entry even when the inflection diverges mid-word (olla↔ollas, llora↔llorar,
// quemaste↔quemar, "acabo de"↔"acabar de"). We compare the FIRST token by
// shared prefix, which absorbs verb-ending and plural drift without matching
// unrelated words (tapa↔tarde stays uncovered).
const firstTok = (s: string) => norm(s).split(/\s+/)[0] ?? "";
const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};
const covers = (target: string, vocabWord: string) => {
  const a = norm(target), b = norm(vocabWord);
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = firstTok(a), tb = firstTok(b);
  const L = commonPrefix(ta, tb);
  return L >= Math.max(3, Math.min(ta.length, tb.length) - 3);
};

const wordCount = (s: string) => (s || "").replace(/\[\[|\]\]/g, "").trim().split(/\s+/).filter(Boolean).length;

/** Returns a list of human-readable issues; empty array = the set is valid. */
export function validateSet(exs: any[], vocabWords?: string[]): string[] {
  const issues: string[] = [];
  if (!Array.isArray(exs) || exs.length === 0) return ["not a non-empty array"];

  const counts: Record<string, number> = {};
  const targetWords: string[] = [];
  let featured = 0;

  for (let i = 0; i < exs.length; i++) {
    const e = exs[i];
    const at = `#${i} ${e?.type ?? "?"}`;
    if (!ALLOWED_TYPES.has(e?.type)) { issues.push(`${at}: unknown type`); continue; }
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.featured !== false) featured++;
    if (JSON.stringify(e).includes("—")) issues.push(`${at} '${e.word}': em-dash`);

    const p = e.payload ?? {};
    const opts: string[] = p.options ?? [];
    const checkOpts = (label: string) => {
      if (opts.length !== 4) issues.push(`${at} ${label}: opts=${opts.length} (need 4)`);
      if (opts[0] !== p.answer) issues.push(`${at} ${label}: opts[0]!=answer`);
      if (new Set(opts).size !== opts.length) issues.push(`${at} ${label}: dup opts`);
    };

    if (e.type === "meaning_in_context") {
      targetWords.push(e.word);
      if (!/\[\[(.+?)\]\]/.test(e.sentence || "")) issues.push(`${at} '${e.word}': no [[ ]]`);
      if (wordCount(e.sentence) > MEANING_MAX_WORDS) issues.push(`${at} '${e.word}': sentence ${wordCount(e.sentence)}w > ${MEANING_MAX_WORDS}`);
      checkOpts(`'${e.word}'`);
      if (!p.audioClip?.sentence || !p.audioClip?.targetWord) issues.push(`${at} '${e.word}': audioClip missing sentence/targetWord`);
    } else if (e.type === "fill_blank") {
      targetWords.push(e.word);
      if (!/_{3,}/.test(e.sentence || "")) issues.push(`${at} '${e.word}': no blank`);
      if (wordCount(e.sentence) > FILL_MAX_WORDS) issues.push(`${at} '${e.word}': sentence ${wordCount(e.sentence)}w > ${FILL_MAX_WORDS}`);
      if (p.answer !== e.word) issues.push(`${at} '${e.word}': answer!=word (${p.answer})`);
      checkOpts(`'${e.word}'`);
      if (!/_{3,}/.test(p.translation || "")) issues.push(`${at} '${e.word}': translation missing/no blank`);
      if ((p.optionTranslations ?? []).length !== 4) issues.push(`${at} '${e.word}': optionTranslations!=4`);
      if (!p.audioClip?.sentence || !p.audioClip?.targetWord) issues.push(`${at} '${e.word}': audioClip missing sentence/targetWord`);
    } else if (e.type === "listen_choose") {
      targetWords.push(e.word);
      checkOpts(`'${e.word}'`);
      if ((p.optionTranslations ?? []).length !== 4) issues.push(`${at} '${e.word}': optionTranslations!=4`);
      if (!p.audioClip?.voiceId) issues.push(`${at} '${e.word}': listen audioClip missing voiceId`);
      if (!p.audioClip?.sentence) issues.push(`${at} '${e.word}': listen audioClip missing sentence`);
    } else if (e.type === "match_meaning") {
      const pairs = p.pairs ?? [];
      if (pairs.length !== 4) issues.push(`${at}: pairs=${pairs.length} (need 4)`);
      for (const pr of pairs) {
        targetWords.push(pr.word);
        if (!(pr.options ?? []).includes(pr.answer)) issues.push(`${at} '${pr.word}': answer not in options`);
        if ((pr.options ?? []).length !== 4) issues.push(`${at} '${pr.word}': opts=${(pr.options ?? []).length}`);
      }
    }
  }

  // Mix: exactly one match, at most one listen, at least one of meaning + fill.
  if ((counts.match_meaning ?? 0) !== 1) issues.push(`match_meaning=${counts.match_meaning ?? 0} (need exactly 1)`);
  if ((counts.listen_choose ?? 0) > 1) issues.push(`listen_choose=${counts.listen_choose} (max 1)`);
  if ((counts.meaning_in_context ?? 0) < 1) issues.push(`no meaning_in_context`);
  if ((counts.fill_blank ?? 0) < 1) issues.push(`no fill_blank`);

  // Featured/pool split.
  const featuredTarget = Math.min(FEATURED_TARGET, exs.length);
  if (featured !== featuredTarget) issues.push(`featured=${featured} (need ${featuredTarget})`);
  if (exs.length > featuredTarget && exs.length - featured < 1) issues.push(`pool is empty`);

  // No target word reused across exercises.
  const distinct = new Set(targetWords.map((w) => norm(w)));
  if (distinct.size !== targetWords.length) issues.push(`reused target words (${targetWords.length} used, ${distinct.size} distinct)`);

  // Full vocab coverage (every vocab word taught by exactly one exercise).
  if (vocabWords && vocabWords.length) {
    const missing = vocabWords.filter((v) => !targetWords.some((t) => covers(t, v)));
    if (missing.length) issues.push(`vocab NOT covered: ${missing.join(", ")}`);
  }

  return issues;
}

// ---- CLI runner ----
if (require.main === module) {
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const authoring: any[] = fs.existsSync(AUTHORING) ? JSON.parse(fs.readFileSync(AUTHORING, "utf8")) : [];
  const vocabBySlug = new Map<string, string[]>(
    authoring.map((s) => [s.slug, (s.vocab ?? []).map((v: any) => v.word).filter(Boolean)])
  );
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !only || f === `${only}.json`)
    .sort();
  let totalIssues = 0;
  for (const f of files) {
    const slug = f.replace(".json", "");
    let exs: any[];
    try { exs = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")); }
    catch (e: any) { console.log(`✗ ${slug}: INVALID JSON ${e.message}`); totalIssues++; continue; }
    const issues = validateSet(exs, vocabBySlug.get(slug));
    if (issues.length) { console.log(`✗ ${slug} (${exs.length} ex):\n    ` + issues.join("\n    ")); totalIssues += issues.length; }
    else console.log(`✓ ${slug} (${exs.length} ex)`);
  }
  console.log(`\n${files.length} files, ${totalIssues} issues`);
  process.exit(totalIssues ? 1 : 0);
}
