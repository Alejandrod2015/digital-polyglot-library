import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
const p = new PrismaClient();
(async () => {
  const j = await p.journeyStory.findMany({ where: { audioWordTimings: { not: null }, audioUrl: { not: null } }, select: { slug: true, audioWordTimings: true } });
  const c = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  const rows: Array<{ k: string; slug: string; rate: number }> = [];
  for (const [k, l] of [["journey", j], ["catalog", c]] as const)
    for (const r of l) {
      const pl = coerceAudioWordTimings(r.audioWordTimings);
      const d = pl?.audioDurationSec ?? 0;
      if (pl && d > 0) rows.push({ k, slug: r.slug ?? "?", rate: pl.words.length / d });
    }
  rows.sort((a, b) => a.rate - b.rate);
  console.log("las 18 mas lentas (palabras/s):");
  for (const r of rows.slice(0, 18)) console.log(`  ${r.rate.toFixed(2)}  ${r.k}/${r.slug.slice(0,46)}`);
  await p.$disconnect();
})();
