import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const JOURNEY = "cmtwz1iop000l32jybeo2jg4x";
const BUNDLE = "french-friends-france-a1";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter(Boolean));
}

function hasNeedle(textNorm: string, word: string): boolean {
  const w = norm(word);
  if (!w) return true;
  if (textNorm.includes(w)) return true;
  const parts = w.split(" ");
  return parts.length === 1 && textNorm.includes(parts[0]);
}

const stale = [
  "mairie",
  "municipal",
  "counter",
  "office",
  "papier administratif",
  "form",
  "stamp",
  "guichet",
  "dossier administratif",
  "quai",
  "train-ticket",
  "association office",
  "apartment hunt",
  "landlord",
];

(async () => {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      topic: true,
      text: true,
      vocab: true,
      practiceSet: {
        select: {
          locked: true,
          exercises: {
            orderBy: { orderIndex: "asc" },
            select: {
              orderIndex: true,
              type: true,
              word: true,
              sentence: true,
              payload: true,
              featured: true,
              audioText: true,
            },
          },
        },
      },
    },
  });
  const glossRows = await p.tapGlossSet.findMany({
    where: { bundle: BUNDLE },
    select: { slug: true, glosses: true },
  });
  const glossBySlug = new Map(glossRows.map((r) => [r.slug, (r.glosses ?? {}) as Record<string, unknown>]));

  for (const s of stories) {
    const text = s.text ?? "";
    const textNorm = norm(text);
    const tok = tokens(text);
    const vocab = Array.isArray(s.vocab) ? s.vocab as Array<{ word?: string; surface?: string }> : [];
    const glosses = glossBySlug.get(s.slug ?? "") ?? {};
    const glossKeys = Object.keys(glosses);
    const missingGlossKeys = glossKeys.filter((k) => !hasNeedle(textNorm, k)).slice(0, 20);
    const staleHits: string[] = [];
    const allPractice = JSON.stringify(s.practiceSet?.exercises ?? []);
    const allGloss = JSON.stringify(glosses);
    const blob = `${text} ${allPractice} ${allGloss}`.toLowerCase();
    for (const w of stale) if (blob.includes(w.toLowerCase())) staleHits.push(w);

    const practiceIssues: string[] = [];
    for (const ex of s.practiceSet?.exercises ?? []) {
      const w = norm(ex.word);
      if (w && !tok.has(w) && !textNorm.includes(w)) {
        practiceIssues.push(`#${ex.orderIndex} word_not_in_text:${ex.word}`);
      }
      const sent = norm(ex.sentence.replace(/_+/g, ex.word));
      if (sent && sent.length > 10) {
        const sentWords = sent.split(" ").filter((x) => x.length > 2);
        const overlap = sentWords.filter((x) => tok.has(x)).length;
        if (overlap < Math.min(3, sentWords.length)) {
          practiceIssues.push(`#${ex.orderIndex} sentence_low_overlap:${ex.sentence}`);
        }
      }
    }

    console.log(`\n${s.slug} | ${s.title} | ${s.topic}`);
    console.log(`vocab:${vocab.length} gloss:${glossKeys.length} practice:${s.practiceSet?.exercises.length ?? 0} locked:${s.practiceSet?.locked ?? false}`);
    if (missingGlossKeys.length) console.log(`missingGlossKeys: ${missingGlossKeys.join(", ")}`);
    if (practiceIssues.length) console.log(`practiceIssues: ${practiceIssues.join(" | ")}`);
    if (staleHits.length) console.log(`staleHits: ${staleHits.join(", ")}`);
    if (!missingGlossKeys.length && !practiceIssues.length && !staleHits.length) console.log("ok");
  }
  await p.$disconnect();
})();
