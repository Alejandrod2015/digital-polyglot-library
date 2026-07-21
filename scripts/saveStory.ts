/**
 * saveStory.ts — THE ONLY sanctioned way to write JourneyStory CONTENT
 * (title/slug/text/vocab/arcType/synopsis) to the database.
 *
 * WHY THIS EXISTS (hard rule, 2026-07-09): a pilot was reported as
 * "validated" after running only the Python PRE-validator (a subset).
 * The canonical gate is `validateGeneratedStory` (src/lib). To make it
 * IMPOSSIBLE to skip that gate, this saver runs the canonical validator
 * IN-PROCESS and refuses to write a single row unless EVERY story in the
 * batch returns ok===true. Validation + write are atomic in one process,
 * so there is no stale-stamp window. The PreToolUse hook
 * `.claude/safety/pre-story-save-guard.sh` blocks every OTHER script that
 * writes journeyStory content, funnelling all saves through here.
 *
 * Usage:
 *   npx tsx scripts/saveStory.ts <data.json> --journey <id> \
 *       [--lang ES] [--level c1] [--variant LATAM] [--publish] [--dry]
 *
 * data.json: array of story objects { topic, slotIndex, title, slug?,
 *   synopsis, text, vocab[], arcType }. Rows are matched by
 *   (journeyId, topic, slotIndex) and updated.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Neutraliza el guard `server-only` (el validador importa el juez CEFR que lo usa).
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory, extractStoryMotifs, type ExistingStorySummary } from "@/lib/validateGeneratedStory";
import { renderedParagraphs } from "@/lib/readerParagraphs";

/** Build the cross-story summary the canonical validator needs to run its
 *  repetition / rotation / opening-rhythm / motif checks against siblings. */
function summarize(d: any): ExistingStorySummary {
  const names = new Set<string>();
  for (const line of String(d.text).split(/\r?\n/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s/);
    if (m) names.add(m[1]);
  }
  const firstPara = String(d.text).split(/\n{2,}/)[0] ?? "";
  const firstSentence = (firstPara.split(/(?<=[.!?])\s/)[0] ?? firstPara).trim();
  return {
    title: d.title,
    arcType: d.arcType ?? null,
    vocabLemmas: (d.vocab ?? []).map((v: any) => String(v.word)),
    characterNames: [...names],
    openingFirstSentence: firstSentence,
    motifTags: extractStoryMotifs(String(d.text)),
  };
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

(async () => {
  const dataFile = process.argv[2];
  if (!dataFile || dataFile.startsWith("--")) {
    console.error("usage: saveStory.ts <data.json> --journey <id> [--lang ES --level c1 --variant LATAM] [--publish] [--dry]");
    process.exit(2);
  }
  const journeyId = arg("journey");
  const dry = flag("dry");
  const publish = flag("publish");
  // C1-NARRATOR profile: single-voice narrated prose (3rd person + brief quotes),
  // NOT multi-voice dialogue. It legitimately fails the format checks that assume
  // "Speaker: line" turns. --narrator exempts EXACTLY those three format checks
  // (dialogue-ratio, speakers-count, speaker-lines) and NOTHING else — modismos,
  // defs, no-digits, arc, CEFR, distribution, cross-story dedup all still gate.
  const narrator = flag("narrator");
  // These checks all assume the multivoice "Speaker: line" format: they read
  // character names / turns from speaker labels, which a narrated prose story
  // (names in the prose, not in labels) does not have. Exempt ONLY these — the
  // same four the spec lists as known A0-narrator exemptions.
  //
  // vocab-count is NOT exempt (2026-07-09). It was, briefly, and that was a
  // mistake: the profile "replaced" the spec's hard minimum of 20 with a
  // homegrown minimum of 12, on the theory that pills stack in prose and read
  // like a highlighted exercise. Our own A0 narrator precedent refutes it —
  // 22-26 items in 135-145 words, ~1 pill per 6 words, shipped and approved,
  // 3x denser. Relaxing a gate so the output passes is exactly what
  // `feedback_calibrate_gates_to_gold_standard` forbids. A high count is
  // bounded by DISTRIBUTION (spread it), never by cutting the count.
  const NARRATOR_EXEMPT = new Set([
    "body-dialogue-ratio", "speakers-count", "speaker-lines", "names-match",
  ]);
  const ctx = {
    language: arg("lang", "ES")!,
    level: arg("level", "c1")!,
    variant: arg("variant", "LATAM")!,
  };
  if (!journeyId && !dry) {
    console.error("FAIL: --journey <id> is required (or use --dry to validate only).");
    process.exit(2);
  }

  const stories = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!Array.isArray(stories)) { console.error("FAIL: data file must be a JSON array."); process.exit(2); }

  // ── GATE: canonical validator, in-process, zero tolerance ──
  // Each story is validated against its already-validated SIBLINGS in this
  // batch (vocab-repetition, arcType-rotation, opening-rhythm, motif and
  // anchor cross-story checks). Topic-by-topic saves put all 3 in one file,
  // so this enforces intra-topic dedup with no manual step.
  const allTitles: string[] = stories.map((s: any) => s.title);
  const priorSummaries: ExistingStorySummary[] = [];
  const results: Array<{ d: any; ok: boolean; fails: string[]; warns: string[] }> = [];
  for (const d of stories) {
    const payload = { title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType };
    const r = await validateGeneratedStory(payload as any, {
      language: ctx.language, level: ctx.level, variant: ctx.variant, topic: d.topic,
      journeyTitles: allTitles.filter((t) => t !== d.title),
      existing: [...priorSummaries],
    });
    priorSummaries.push(summarize(d));
    const hardFails = r.checks.filter((c) => c.status === "fail" && !(narrator && NARRATOR_EXEMPT.has(c.id)));
    const warnsExtra: string[] = [];
    // Distribution, re-measured on the blocks the reader ACTUALLY renders.
    //
    // This is the one piece of the narrator profile that earns its keep. The
    // canonical vocab-distribution check counts pills per AUTHORED paragraph,
    // but the reader throws narrated prose's "\n\n" away and re-groups it into
    // 3-sentence blocks (src/lib/readerParagraphs) — so in narrator mode that
    // check measures a structure nobody sees. Same rule, right object.
    //
    // CALIBRATION IS THE CANONICAL ONE, not a homegrown "max 3": cluster =
    // some block empty while another carries 6+, ceiling = 30% of the story's
    // items in a single block. Measured with the reader's own function so the
    // rule cannot drift from the render.
    if (narrator) {
      // A0 bodies are short and the reader groups them into fewer 3-sentence
      // blocks, so a single block naturally carries a larger share of the ~24
      // pills. Gold A0 tops out near 38%; give the floor a calibrated cap.
      const isA0 = (ctx.level ?? "").toUpperCase() === "A0";
      const blockCap = isA0 ? 0.45 : 0.3;
      const blocks = renderedParagraphs(String(d.text));
      const vocab = (d.vocab ?? []) as any[];
      const perBlock = blocks.map((b) => vocab.filter((v) => b.includes(v.surface ?? v.word)).length);
      const worst = perBlock.length ? Math.max(...perBlock) : 0;
      const empty = perBlock.filter((n) => n === 0).length;
      const maxPct = vocab.length > 0 ? worst / vocab.length : 0;
      if (empty > 0 && worst >= 6 && !isA0) {
        hardFails.push({ id: "narrator-block-cluster", label: "", status: "fail",
          detail: `pills cluster: ${empty} rendered paragraph(s) with none while another carries ${worst}. Per-block: [${perBlock.join(", ")}]` } as any);
      } else if (maxPct > blockCap) {
        hardFails.push({ id: "narrator-block-distribution", label: "", status: "fail",
          detail: `${worst}/${vocab.length} items (${(maxPct * 100).toFixed(0)}%) land in one rendered paragraph (max 30%). Per-block: [${perBlock.join(", ")}]` } as any);
      }
      if (empty > 0) warnsExtra.push(`[narrator-empty-blocks] ${empty} rendered paragraph(s) with no vocab: [${perBlock.join(", ")}]`);
    }
    const exempted = r.checks.filter((c) => c.status === "fail" && narrator && NARRATOR_EXEMPT.has(c.id));
    const fails = hardFails.map((c) => `[${c.id}] ${c.detail ?? c.label}`);
    const warns = r.checks.filter((c) => c.status === "warn").map((c) => `[${c.id}] ${c.detail ?? c.label}`);
    warns.push(...warnsExtra);
    if (exempted.length) warns.push(...exempted.map((c) => `[narrator-exempt: ${c.id}]`));
    results.push({ d, ok: hardFails.length === 0, fails, warns });
    const tag = hardFails.length === 0 ? "OK  " : "FAIL";
    console.log(`\n=== ${tag} ${d.topic}#${d.slotIndex} "${d.title}"${narrator ? " [narrator]" : ""}  pass=${r.summary.pass} warn=${r.summary.warn} fail=${r.summary.fail}`);
    for (const f of fails) console.log("   FAIL " + f);
    for (const w of warns) console.log("   warn " + w);
  }

  const anyFail = results.some((r) => !r.ok);
  if (anyFail) {
    console.error(`\n✗ CANONICAL VALIDATION FAILED (${results.filter((r) => !r.ok).length}/${results.length} stories). NOTHING WRITTEN.`);
    process.exit(1);
  }
  console.log(`\n✓ All ${results.length} stories pass the canonical validator (${ctx.language} ${ctx.level} ${ctx.variant}).`);

  if (dry) { console.log("--dry: no DB write."); return; }

  // ── WRITE (only reached when every story is green) ──
  const prisma = new PrismaClient();
  try {
    for (const { d } of results) {
      const slot = await prisma.journeyStory.findFirst({ where: { journeyId, topic: d.topic, slotIndex: d.slotIndex } });
      if (!slot) { console.log(`  NO slot for ${d.topic}#${d.slotIndex} (skipped)`); continue; }
      const slug = d.slug || slugify(d.title);
      await prisma.journeyStory.update({
        where: { id: slot.id },
        data: {
          title: d.title, slug, text: d.text, vocab: d.vocab,
          arcType: d.arcType, synopsis: d.synopsis,
          ...(publish ? { status: "published" } : {}),
        },
      });
      console.log(`  saved ${d.topic}#${d.slotIndex} -> ${slug}${publish ? " (published)" : ""}`);
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
