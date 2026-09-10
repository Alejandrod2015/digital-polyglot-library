/** SOLO LECTURA. Portables (verb/adjective/adverb/expression) que a0/a1/b1 ya
 *  enseñaron y que estan dentro de la lista A1A2: la capa reabrible del A2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese" } },
    select: { vocab: true, journey: { select: { levels: true } } },
  });
  const porTipo: Record<string, Set<string>> = { verb: new Set(), adjective: new Set(), adverb: new Set(), expression: new Set() };
  for (const r of st)
    for (const v of (r.vocab ?? []) as Array<{ word?: string; type?: string }>) {
      const t = String(v.type ?? "").toLowerCase();
      const w = String(v.word ?? "").toLowerCase();
      if (!w || !PORT.has(t)) continue;
      if (isPortugueseA1A2(w)) porTipo[t].add(w);
    }
  for (const [t, s] of Object.entries(porTipo)) {
    console.log(`\n${t} (${s.size} reabribles en nivel):`);
    console.log("  " + [...s].sort().join(" "));
  }
})().finally(() => p.$disconnect());
