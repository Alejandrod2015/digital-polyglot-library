import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { applyNarrationPostProcess, computeNarratorOffIntervals } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUGS = ["sabado-de-mercado", "no-hay-cafe", "mateo-trae-pan-dulce", "se-fue-la-luz"];
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/";
const PAD = 0.6;

function padMerge(intervals: [number, number][]): [number, number][] {
  const padded = intervals.map(([a, b]) => [Math.max(0, a - PAD), b + PAD] as [number, number]).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const iv of padded) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push(iv);
  }
  return out;
}

(async () => {
  const p = new PrismaClient();
  for (const slug of SLUGS) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, text: true, audioSegments: true, audioFilename: true } });
    if (!s?.text || !s.audioFilename) { console.log(`!! ${slug}: incompleto`); continue; }
    const { intervals } = computeNarratorOffIntervals(s.text, s.audioSegments);
    if (intervals.length === 0) { console.log(`!! ${slug}: 0 intervalos de aeneas, salto`); continue; }
    const padded = padMerge(intervals);
    const dryName = s.audioFilename.replace(/\.mp3$/, "").replace(/_atempo[\d.]+_\d+$/, "") + ".mp3";
    const dryUrl = BASE + dryName;
    console.log(`${slug}: ${intervals.length} OFF aeneas -> ${padded.length} con margen ±${PAD}s`);
    const pp = await applyNarrationPostProcess({ storyId: s.id, sourceUrl: dryUrl, tempo: 1.0, narratorOffIntervals: padded });
    console.log(`   ok: ${pp.audioFilename}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
