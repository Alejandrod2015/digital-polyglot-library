import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimingsTypes";
const p = new PrismaClient();
(async () => {
  const books = await p.catalogBook.findMany({ where: { published: true }, select: { slug: true, title: true } });
  const timings = await p.catalogStoryAudioTimings.findMany({ select: { slug: true, audioWordTimings: true } });
  const byslug = new Map(timings.map((t) => [t.slug, t.audioWordTimings]));
  console.log(`${"libro".padEnd(42)}${"hist".padStart(6)}${"pal/s medio".padStart(13)}${"bajo 2.0".padStart(10)}`);
  for (const b of books) {
    const stories = await p.catalogStory.findMany({ where: { book: { slug: b.slug } }, select: { slug: true } });
    const rates: number[] = [];
    for (const s of stories) {
      const pl = coerceAudioWordTimings(byslug.get(s.slug));
      const d = pl?.audioDurationSec ?? 0;
      if (pl && d > 0) rates.push(pl.words.length / d);
    }
    if (!rates.length) continue;
    const mean = rates.reduce((a, c) => a + c, 0) / rates.length;
    const low = rates.filter((r) => r < 2.0).length;
    console.log(`${b.slug.slice(0, 41).padEnd(42)}${String(rates.length).padStart(6)}${mean.toFixed(2).padStart(13)}${String(low).padStart(10)}`);
  }
  await p.$disconnect();
})();
