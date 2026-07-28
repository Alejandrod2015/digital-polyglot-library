/** Text/audio mismatch screen, no STT needed.
 * Narration runs ~2.0-3.0 words/sec. A story whose stored text yields far
 * fewer words per second than that has an audio saying MORE than the text,
 * so no aligner can place its words correctly. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
const p = new PrismaClient();
(async () => {
  const j = await p.journeyStory.findMany({
    where: { audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioWordTimings: true },
  });
  const c = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  const rows: Array<{ kind: string; slug: string; rate: number; words: number; dur: number }> = [];
  for (const [kind, list] of [["journey", j], ["catalog", c]] as const) {
    for (const r of list) {
      const pl = coerceAudioWordTimings(r.audioWordTimings);
      const dur = pl?.audioDurationSec ?? 0;
      if (!pl || dur <= 0) continue;
      rows.push({ kind, slug: r.slug ?? "?", rate: pl.words.length / dur, words: pl.words.length, dur });
    }
  }
  rows.sort((a, b) => a.rate - b.rate);
  const rates = rows.map((r) => r.rate).sort((a, b) => a - b);
  const med = rates[Math.floor(rates.length / 2)];
  console.log(`historias: ${rows.length} | ritmo mediano: ${med.toFixed(2)} palabras/s`);
  const suspect = rows.filter((r) => r.rate < med * 0.7);
  console.log(`sospechosas (ritmo < 70% del mediano, el audio dice mas que el texto): ${suspect.length}`);
  const byKind: Record<string, number> = {};
  for (const s of suspect) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  console.log(`  por tipo: ${JSON.stringify(byKind)}`);
  for (const s of suspect.slice(0, 25)) {
    console.log(`  ${s.kind}/${s.slug.slice(0, 44).padEnd(46)} ${s.rate.toFixed(2)} pal/s (${s.words} pal / ${s.dur.toFixed(0)}s)`);
  }
  await p.$disconnect();
})();
