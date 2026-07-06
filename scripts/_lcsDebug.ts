// Scratch: replica alignStorySentencesToWords para ver por qué "claro"
// (sentence "Cobrador: ¡Claro que sí!") queda sin match.
import { config } from "dotenv";
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", quiet: true });
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env", quiet: true });

import { prisma } from "../src/lib/prisma";
import { alignStoryAudio, extractStoryPlainText } from "../src/lib/audioWordTimings";
import { splitStoryTextIntoSentences, normalizeSegmentText } from "../src/lib/audioSegments";

const tok = (v: string) => normalizeSegmentText(v).split(" ").filter(Boolean);

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "la-combi-equivocada" },
    select: {
      id: true, text: true, title: true, audioUrl: true, audioFragments: true,
      journey: { select: { language: true } },
    },
  });
  if (!story?.text || !story.audioUrl) throw new Error("story incomplete");

  const { payload } = await alignStoryAudio({
    text: story.text, title: story.title, audioUrl: story.audioUrl,
    language: story.journey.language, storyId: story.id, fragments: story.audioFragments,
  });

  const storyPlainText = extractStoryPlainText(story.text);
  const sentences = splitStoryTextIntoSentences(storyPlainText);

  // Rebuild transcript token stream the same way buildTranscriptTokensFromWords does
  type TT = { token: string; startSec: number; endSec: number };
  const transcriptTokens: TT[] = [];
  for (const w of payload.words) {
    if (typeof w.startSec !== "number" || typeof w.endSec !== "number") continue;
    if (w.endSec <= w.startSec) { console.log(`DROPPED zero-dur: ${w.text} @${w.startSec}`); continue; }
    const parts = tok(w.text);
    for (let i = 0; i < parts.length; i += 1) {
      const d = w.endSec - w.startSec;
      transcriptTokens.push({ token: parts[i], startSec: w.startSec + (d * i) / parts.length, endSec: w.startSec + (d * (i + 1)) / parts.length });
    }
  }

  const storyTokens: { token: string; sentence: number }[] = [];
  sentences.forEach((s, si) => { for (const t of tok(s)) storyTokens.push({ token: t, sentence: si }); });

  const rows = storyTokens.length, cols = transcriptTokens.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1)
    for (let j = cols - 1; j >= 0; j -= 1)
      dp[i][j] = storyTokens[i].token === transcriptTokens[j].token ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const map = new Map<number, number>();
  let i = 0, j = 0;
  while (i < rows && j < cols) {
    if (storyTokens[i].token === transcriptTokens[j].token) { map.set(i, j); i++; j++; continue; }
    if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }

  const target = sentences.findIndex((s) => s.includes("Claro que"));
  console.log(`target sentence #${target}: "${sentences[target]}"`);
  storyTokens.forEach((st, si) => {
    if (st.sentence >= target - 1 && st.sentence <= target + 1) {
      const tj = map.get(si);
      const tt = typeof tj === "number" ? transcriptTokens[tj] : null;
      console.log(`  s${st.sentence} story[${si}] "${st.token}" -> ${tt ? `T[${tj}] "${tt.token}" ${tt.startSec.toFixed(2)}-${tt.endSec.toFixed(2)}` : "UNMATCHED"}`);
    }
  });
}

main().finally(() => prisma.$disconnect());
