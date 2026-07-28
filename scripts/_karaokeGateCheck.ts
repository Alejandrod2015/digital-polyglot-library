import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
import { checkKaraokeUsable } from "../src/lib/karaokeQualityGate";
const p = new PrismaClient();
(async () => {
  const j = await p.journeyStory.findMany({ where: { audioWordTimings: { not: null }, audioUrl: { not: null } }, select: { slug: true, audioWordTimings: true } });
  const c = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  let ok = 0; const blocked: string[] = [];
  for (const [k, l] of [["journey", j], ["catalog", c]] as const)
    for (const r of l) {
      const pl = coerceAudioWordTimings(r.audioWordTimings);
      const g = checkKaraokeUsable(r.slug, pl);
      if (g.usable) ok += 1; else blocked.push(`${k}/${r.slug} -> ${g.reason}`);
    }
  console.log(`con karaoke: ${ok}`);
  console.log(`sin karaoke (lector limpio): ${blocked.length}`);
  for (const b of blocked) console.log(`  ${b}`);
  await p.$disconnect();
})();
