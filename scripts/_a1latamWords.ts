/** Chequea candidatos de vocab del A1 latam: nivel A1, ban duro y ban blando. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { createRequire } from "module";
import { PrismaClient } from "../src/generated/prisma";
const __req = createRequire(__filename);
try { const sp = __req.resolve("server-only"); (__req as any).cache[sp] = { id: sp, filename: sp, loaded: true, exports: {} }; } catch {}
const p = new PrismaClient();
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
(async () => {
  const { filterSpanishWordsAtOrBelow } = await import("../src/lib/cefr/spanishLevelJudge");
  const words = process.argv.slice(2);
  const js = await p.journey.findMany({ where: { language: "spanish", status: { not: "archived" } } });
  const dura = new Set<string>(); const blanda = new Set<string>();
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { vocab: true } });
    const dest = j.typeSlug === "traveler" ? dura : blanda;
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) if (v?.word) dest.add(norm(String(v.word)));
  }
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(words, "a1");
  const bad = new Map(aboveLevel.map((a) => [a.word, a.judgedLevel]));
  for (const w of words) {
    const flags = [
      dura.has(norm(w)) ? "BAN-DURO" : "",
      !dura.has(norm(w)) && blanda.has(norm(w)) ? "ban-blando" : "",
      bad.has(w) ? `NIVEL-${String(bad.get(w)).toUpperCase()}` : "",
    ].filter(Boolean);
    console.log(`${w.padEnd(22)} ${flags.length ? flags.join(" ") : "ok"}`);
  }
  await p.$disconnect();
})();
