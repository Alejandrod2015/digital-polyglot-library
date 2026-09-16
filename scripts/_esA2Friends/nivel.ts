// Solo lectura: body-level-frequency con las MISMAS funciones del validador
// (extractSpanishContentWords + filterSpanishWordsAtOrBelow, nivel a2).
//   npx tsx scripts/_esA2Friends/nivel.ts <journeyId> | --json <fichero>
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const req = createRequire(__filename);
try { const p = req.resolve("server-only"); (req as any).cache[p] = { id: p, filename: p, loaded: true, exports: {} }; } catch {}
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const { extractSpanishContentWords, filterSpanishWordsAtOrBelow } = await import("../../src/lib/cefr/spanishLevelJudge");
  let hist: Array<{ title: string; text: string; topic: string; slotIndex: number }>;
  if (process.argv[2] === "--json") hist = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  else {
    const p = new PrismaClient();
    const j = await p.journey.findUnique({ where: { id: process.argv[2] }, select: { topics: true, stories: { where: { text: { not: null } }, select: { title: true, text: true, topic: true, slotIndex: true } } } });
    await p.$disconnect();
    hist = (j!.stories as any[]).sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  }
  for (const s of hist) {
    const cw = extractSpanishContentWords(s.text);
    const { aboveLevel } = await filterSpanishWordsAtOrBelow(cw, "a2");
    const pct = (100 * aboveLevel.length) / cw.length;
    console.log(`${pct.toFixed(1).padStart(5)}%  ${aboveLevel.length}/${cw.length}  ${s.title}  |  ${aboveLevel.map((a) => a.word).join(", ")}`);
  }
})();
