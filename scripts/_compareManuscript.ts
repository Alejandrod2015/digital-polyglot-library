import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
const p = new PrismaClient();
const wc = (s: string) => s.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
(async () => {
  const dir = process.argv[2];
  const slugs = readdirSync(dir).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4));
  const timings = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  const dur = new Map(timings.map((t) => [t.slug, coerceAudioWordTimings(t.audioWordTimings)?.audioDurationSec ?? 0]));
  console.log(`${"historia".padEnd(36)}${"base".padStart(6)}${"libro".padStart(7)}${"+".padStart(6)}${"pal/s con libro".padStart(16)}`);
  let cambian = 0;
  for (const slug of slugs.sort()) {
    const row = await p.catalogStory.findFirst({ where: { slug }, select: { text: true } });
    if (!row) continue;
    const a = wc(row.text);
    const b = wc(readFileSync(path.join(dir, `${slug}.txt`), "utf-8"));
    const d = dur.get(slug) ?? 0;
    const rate = d > 0 ? b / d : 0;
    if (b > a * 1.05) cambian += 1;
    console.log(`${slug.slice(0, 35).padEnd(36)}${String(a).padStart(6)}${String(b).padStart(7)}${String(b - a).padStart(6)}${rate.toFixed(2).padStart(16)}`);
  }
  console.log(`\nhistorias que ganan texto: ${cambian}/${slugs.length}`);
  await p.$disconnect();
})();
