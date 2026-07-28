import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
import { buildWordWindows } from "../src/lib/karaokeWordWindows";
const p = new PrismaClient();
(async () => {
  const j = await p.journeyStory.findMany({
    where: { audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioWordTimings: true },
  });
  const c = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  let words = 0, nulls = 0, unreachable = 0, stories = 0;
  const bad: string[] = [];
  for (const [kind, rows] of [["journey", j], ["catalog", c]] as const) {
    for (const r of rows) {
      const pl = coerceAudioWordTimings(r.audioWordTimings);
      if (!pl) continue;
      stories += 1;
      words += pl.words.length;
      const n = pl.words.filter((w) => w.startSec === null).length;
      nulls += n;
      // every timed word must appear exactly once in the computed windows
      const w = buildWordWindows(pl.words, pl.audioDurationSec);
      const seen = new Set(w.map((x) => x.index));
      const missing = pl.words.filter((_, i) => !seen.has(i)).length;
      unreachable += missing;
      if (n > 0 || missing !== n) bad.push(`${kind}/${r.slug} nulls=${n} sinVentana=${missing}`);
    }
  }
  console.log(`payloads: ${stories} | palabras: ${words}`);
  console.log(`  sin startSec (nunca se podrian resaltar): ${nulls}`);
  console.log(`  sin ventana asignada:                     ${unreachable}`);
  for (const b of bad.slice(0, 10)) console.log(`  ${b}`);
  await p.$disconnect();
})();
