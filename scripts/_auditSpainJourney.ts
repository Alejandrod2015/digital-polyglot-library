import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmqc6tojm000032el2ebwsgkn";

const COGNATES = new Set(["importante","normal","social","problema","idea","momento","televisión","radio","posible","competición","magia","veredicto","admitir","increíble","famoso","misterioso","paciencia","secreto","color","familia"]);
const FILLER = /\b(jaja+|jeje+|haha+|haha|hmm+|eh{2,}|ah{2,}|mmm+|uy|ugh|oh+|aj[aá]+)\b/i;
const STAGE = /\(([^)]*\b(ríe|suspira|risas|pausa|laughs|sighs)\b[^)]*)\)|\[[^\]]+\]/i;
const ARGENTINE = /\b(vos|sos|che|ten[é]s|quer[é]s|sab[é]s|pod[é]s|dec[í]s)\b/i;

function firstParagraph(text: string): string {
  return text.split(/\n+/)[0] ?? "";
}
function speakers(text: string): string[] {
  const s = new Set<string>();
  for (const line of text.split(/\n+/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+):\s/);
    if (m) s.add(m[1]);
  }
  return [...s];
}
function stripPrefix(w: string) {
  return w.replace(/^(an|ge|ver|be|er|ent|auf|aus|ein|nach|re|des|en)/i, "");
}

async function run() {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID, status: "generated" },
    select: { slug: true, topic: true, slotIndex: true, title: true, text: true, vocab: true, arcType: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`Auditing ${stories.length} generated stories\n`);

  const allVocab = new Map<string, string[]>(); // word -> [slugs]
  let problems = 0;
  const openings: string[] = [];

  for (const s of stories) {
    const body = s.text ?? "";
    const vocab = (s.vocab as Array<{ word: string; surface?: string; type?: string; definition: string }>) ?? [];
    const issues: string[] = [];

    if (vocab.length < 20) issues.push(`vocab ${vocab.length} <20`);

    // surface in body
    for (const v of vocab) {
      const probe = (v.surface ?? v.word).toLowerCase();
      if (!body.toLowerCase().includes(probe)) issues.push(`surface NOT in body: ${probe}`);
    }
    // cross-story overlap (by lemma word)
    for (const v of vocab) {
      const k = v.word.toLowerCase();
      if (!allVocab.has(k)) allVocab.set(k, []);
      allVocab.get(k)!.push(s.slug);
    }
    // cognates
    const cog = vocab.filter((v) => COGNATES.has(v.word.toLowerCase()));
    if (cog.length) issues.push(`cognates: ${cog.map((v) => v.word).join(",")}`);
    // same-root dupes
    const roots = new Map<string, string>();
    for (const v of vocab) {
      const r = stripPrefix(v.word.toLowerCase().replace(/\s/g, "")).slice(0, 5);
      if (r.length >= 4 && roots.has(r)) issues.push(`same-root: ${roots.get(r)}/${v.word}`);
      else if (r.length >= 4) roots.set(r, v.word);
    }
    // em-dash
    if (body.includes("—") || body.includes("–")) issues.push("EM-DASH in body");
    // filler / stage
    if (FILLER.test(body)) issues.push(`FILLER sound: ${body.match(FILLER)?.[0]}`);
    if (STAGE.test(body)) issues.push(`STAGE direction: ${body.match(STAGE)?.[0]}`);
    // argentine leak
    if (ARGENTINE.test(body)) issues.push(`ARGENTINE marker: ${body.match(ARGENTINE)?.[0]}`);
    // definitions 8-14 words + banned openers
    for (const v of vocab) {
      const wc = v.definition.trim().split(/\s+/).length;
      if (wc < 8 || wc > 14) issues.push(`def ${wc}w: ${v.word}`);
      if (/^(Refers to|Describes|Used to|Used for|Said when)/i.test(v.definition)) issues.push(`banned opener: ${v.word}`);
    }
    // named speakers introduced in narration BEFORE their first spoken line
    const lines = body.split(/\n+/);
    for (const sp of speakers(body)) {
      const firstLineIdx = lines.findIndex((l) => new RegExp(`^${sp}:\\s`).test(l));
      const narrationBefore = lines.slice(0, firstLineIdx)
        .filter((l) => !/^[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+:\s/.test(l)).join(" ").toLowerCase();
      if (!narrationBefore.includes(sp.toLowerCase())) issues.push(`speaker not introduced before speaking: ${sp}`);
    }
    // bare imperative heuristic: a dialogue turn that is one short sentence ending in period
    for (const line of body.split(/\n+/)) {
      const m = line.match(/^[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+:\s+(.+)$/);
      if (!m) continue;
      const turn = m[1].trim();
      const sentences = turn.split(/(?<=[.?!])\s+/).filter(Boolean);
      if (sentences.length === 1 && /\.$/.test(turn) && !/[?!]/.test(turn)) {
        const words = turn.replace(/[.,]/g, "").split(/\s+/);
        if (words.length <= 4) issues.push(`maybe bare imperative: "${turn}"`);
      }
    }
    // vocab distribution per paragraph
    const paras = body.split(/\n+/).filter((x) => x.trim().length > 20);
    const perPara = paras.map((para) => vocab.filter((v) => para.toLowerCase().includes((v.surface ?? v.word).toLowerCase())).length);
    const maxP = Math.max(...perPara);
    if (maxP >= 7) issues.push(`¶ clustered ${maxP} vocab`);

    openings.push(firstParagraph(body).split(/[.]/)[0]);

    if (issues.length) { problems += issues.length; console.log(`⚠ ${s.slug} [${s.arcType}]`); for (const i of issues) console.log(`   - ${i}`); }
    else console.log(`✓ ${s.slug} [${s.arcType}] clean`);
  }

  // cross-story repeats
  console.log("\n=== Cross-story vocab repeats ===");
  let repeats = 0;
  for (const [w, slugs] of allVocab) {
    if (slugs.length > 1) { console.log(`  ${w}: ${slugs.join(", ")}`); repeats++; }
  }
  if (!repeats) console.log("  (none)");

  // opening rotation
  console.log("\n=== Openings (first clause) ===");
  openings.forEach((o, i) => console.log(`  ${i + 1}. ${o.trim()}`));
  const esCount = openings.filter((o) => /^\s*Es\s+(lunes|martes|miércoles|jueves|viernes|sábado|domingo|de\s)/i.test(o)).length;
  console.log(`  "Es [día]" openers: ${esCount} (spec: max 2)`);

  console.log(`\nTotal issue lines: ${problems}, cross-story repeats: ${repeats}`);
  await p.$disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
