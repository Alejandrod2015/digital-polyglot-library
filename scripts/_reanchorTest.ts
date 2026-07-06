// Scratch: verifica el re-anclaje de tokens a audioFragments sobre
// la-combi-equivocada SIN escribir a la DB. Imprime los segments viejos
// (DB) vs los nuevos (alignStoryAudio con fragments).
import { config } from "dotenv";
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", quiet: true });
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env", quiet: true });

import { prisma } from "../src/lib/prisma";
import { alignStoryAudio } from "../src/lib/audioWordTimings";

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "la-combi-equivocada" },
    select: {
      id: true,
      text: true,
      title: true,
      audioUrl: true,
      audioFragments: true,
      audioSegments: true,
      journey: { select: { language: true } },
    },
  });
  if (!story?.text || !story.audioUrl) throw new Error("story incomplete");

  const { segments, payload } = await alignStoryAudio({
    text: story.text,
    title: story.title,
    audioUrl: story.audioUrl,
    language: story.journey.language,
    storyId: story.id,
    fragments: story.audioFragments,
  });

  if (process.env.DUMP_WORDS) {
    for (const w of payload.words) {
      if (typeof w.startSec === "number" && ((w.startSec > 32 && w.startSec < 37) || (w.startSec > 58.5 && w.startSec < 66))) {
        console.log(`${w.startSec.toFixed(2)}-${(w.endSec ?? 0).toFixed(2)}  ${w.text}`);
      }
    }
  }

  const old = Array.isArray(story.audioSegments) ? (story.audioSegments as any[]) : [];
  console.log("OLD (DB)                      NEW (fragment-anchored)");
  const n = Math.max(old.length, segments.length);
  for (let i = 0; i < n; i += 1) {
    const o = old[i];
    const s = segments[i];
    const left = o ? `${Number(o.startSec).toFixed(2)}-${Number(o.endSec).toFixed(2)}` : "            ";
    const right = s ? `${s.startSec.toFixed(2)}-${s.endSec.toFixed(2)}` : "            ";
    console.log(`${left.padEnd(14)} ${right.padEnd(14)} ${String((s ?? o)?.text ?? "").slice(0, 60)}`);
  }
}

main().finally(() => prisma.$disconnect());
