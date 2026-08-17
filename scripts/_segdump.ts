import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "la-combi-equivocada" },
    select: {
      id: true,
      slug: true,
      title: true,
      audioUrl: true,
      audioFilename: true,
      audioStatus: true,
      voiceId: true,
      ambientTag: true,
      audioSegments: true,
      audioFragments: true,
      audioWordTimings: true,
      journey: { select: { language: true, name: true } },
    },
  });
  if (!story) {
    console.log("NOT FOUND");
    return;
  }
  const { audioSegments, audioFragments, audioWordTimings, ...rest } = story;
  console.log(JSON.stringify(rest, null, 2));

  const segs = Array.isArray(audioSegments) ? (audioSegments as any[]) : [];
  console.log(`\n--- audioSegments (${segs.length}) ---`);
  for (const s of segs) {
    console.log(`${Number(s.startSec).toFixed(2)}-${Number(s.endSec).toFixed(2)}  ${String(s.text).slice(0, 80)}`);
  }

  const frags = Array.isArray(audioFragments) ? (audioFragments as any[]) : [];
  console.log(`\n--- audioFragments (${frags.length}) ---`);
  for (const f of frags) {
    console.log(`${Number(f.startSec).toFixed(2)}-${Number(f.endSec).toFixed(2)}  [${f.speaker}] ${String(f.text).slice(0, 70)}`);
  }

  const wt = audioWordTimings as any;
  if (wt && Array.isArray(wt.words)) {
    console.log(`\n--- wordTimings: version=${wt.version} durationSec=${wt.audioDurationSec} words=${wt.words.length} ---`);
    // Print words between 15s and 26s
    for (const w of wt.words) {
      if (typeof w.startSec === "number" && w.startSec >= 14 && w.startSec <= 27) {
        console.log(`${w.startSec.toFixed(2)}-${(w.endSec ?? 0).toFixed(2)}  ${w.text}`);
      }
    }
  } else {
    console.log("\n--- no wordTimings ---");
  }
}

main().finally(() => prisma.$disconnect());
