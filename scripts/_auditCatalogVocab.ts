import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

const MAX_HIGHLIGHT_WORDS = 30;
const MAX_HIGHLIGHT_WORD_LENGTH = 48;
const MAX_HIGHLIGHT_WORD_TOKENS = 4;

function stripHtml(raw: string) {
  return raw.replace(/<[^>]+>/g, " ");
}
function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function appearsInText(word: string, text: string) {
  try {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(word)}($|[^\\p{L}\\p{N}_])`, "iu");
    return re.test(text);
  } catch {
    return false;
  }
}

type V = { word?: string; surface?: string; definition?: string; type?: string };

async function main() {
  const books = await p.catalogBook.findMany({
    orderBy: [{ published: "desc" }, { slug: "asc" }],
    include: { stories: { orderBy: { position: "asc" } } },
  });

  const shapeKeys = new Map<string, number>();
  const totals = {
    stories: 0,
    vocabItems: 0,
    orphans: 0,
    dropShort: 0,
    dropTokens: 0,
    overCap: 0,
    dupes: 0,
    noDef: 0,
    defEqWord: 0,
    noType: 0,
    htmlLeft: 0,
    noSynopsis: 0,
  };

  for (const b of books) {
    if (!b.published) continue;
    const issues: string[] = [];
    console.log(`\n########## ${b.slug} (${b.language}/${b.variant ?? "-"}/${b.region ?? "-"}) lvl=${b.level}/${b.cefrLevel ?? "-"}`);
    for (const s of b.stories) {
      totals.stories += 1;
      const rawText = s.text ?? "";
      const hasHtml = /<[a-z][\s\S]*>/i.test(rawText);
      const plain = stripHtml(rawText);
      const vocab = (Array.isArray(s.vocab) ? (s.vocab as unknown as V[]) : []).filter(Boolean);
      totals.vocabItems += vocab.length;
      for (const v of vocab) for (const k of Object.keys(v ?? {})) shapeKeys.set(k, (shapeKeys.get(k) ?? 0) + 1);

      const seen = new Set<string>();
      const orphans: string[] = [];
      const shortWords: string[] = [];
      const longPhrases: string[] = [];
      const dupes: string[] = [];
      const noDef: string[] = [];
      const defEq: string[] = [];
      const noType: string[] = [];

      vocab.forEach((v) => {
        const surface = (v.surface ?? "").trim();
        const word = (v.word ?? "").trim();
        const probe = surface || word;
        const key = probe.toLowerCase();
        if (!probe) return;
        if (seen.has(key)) dupes.push(probe);
        seen.add(key);
        if (!appearsInText(probe, plain)) orphans.push(probe);
        if (probe.length < 3) shortWords.push(probe);
        if (probe.split(/\s+/).filter(Boolean).length > MAX_HIGHLIGHT_WORD_TOKENS || probe.length > MAX_HIGHLIGHT_WORD_LENGTH)
          longPhrases.push(probe);
        const def = (v.definition ?? "").trim();
        if (!def) noDef.push(probe);
        else if (def.toLowerCase() === probe.toLowerCase()) defEq.push(probe);
        if (!(v.type ?? "").trim()) noType.push(probe);
      });

      const over = Math.max(0, vocab.length - MAX_HIGHLIGHT_WORDS);
      totals.orphans += orphans.length;
      totals.dropShort += shortWords.length;
      totals.dropTokens += longPhrases.length;
      totals.overCap += over;
      totals.dupes += dupes.length;
      totals.noDef += noDef.length;
      totals.defEqWord += defEq.length;
      totals.noType += noType.length;
      if (hasHtml) totals.htmlLeft += 1;
      if (!s.synopsis) totals.noSynopsis += 1;

      const wc = plain.trim().split(/\s+/).filter(Boolean).length;
      const density = wc ? ((vocab.length / wc) * 100).toFixed(1) : "0";
      const flags: string[] = [];
      if (orphans.length) flags.push(`ORPHAN(${orphans.length}): ${orphans.slice(0, 6).join(", ")}`);
      if (shortWords.length) flags.push(`SHORT(<3): ${shortWords.join(", ")}`);
      if (longPhrases.length) flags.push(`LONGPHRASE: ${longPhrases.join(" | ")}`);
      if (over) flags.push(`OVER_CAP(+${over})`);
      if (dupes.length) flags.push(`DUPE: ${dupes.join(", ")}`);
      if (noDef.length) flags.push(`NO_DEF: ${noDef.join(", ")}`);
      if (defEq.length) flags.push(`DEF==WORD: ${defEq.join(", ")}`);
      if (noType.length) flags.push(`NO_TYPE(${noType.length})`);
      if (hasHtml) flags.push("HTML_IN_TEXT");
      if (!s.synopsis) flags.push("NO_SYNOPSIS");

      console.log(
        `  ${String(s.position).padStart(2)} ${s.slug.padEnd(50)} w=${String(wc).padStart(4)} v=${String(vocab.length).padStart(2)} d=${density}%` +
          (flags.length ? `\n       ! ${flags.join("\n       ! ")}` : "")
      );
    }
    if (issues.length) console.log(issues.join("\n"));
  }

  console.log("\n===== TOTALS (published books only) =====");
  console.log(totals);
  console.log("vocab item keys seen:", Object.fromEntries(shapeKeys));
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
