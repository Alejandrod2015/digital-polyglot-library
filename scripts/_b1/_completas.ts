import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const EX = new Set(JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8"))
  .bundles["spanish-traveler-spain-b1"] ? [
    ...JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles["spanish-traveler-spain-b1"].articles,
    ...JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles["spanish-traveler-spain-b1"].numerals,
    ...JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles["spanish-traveler-spain-b1"].characterNames,
  ] : []);
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" } });
  const global = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true, title: true, text: true } });
  for (const s of ss) {
    const capa = (filas.find((f) => f.slug === s.slug)?.glosses ?? {}) as Record<string, any>;
    const tok = [...new Set(`${s.title} ${s.text}`.toLowerCase().match(/[\p{L}]+/gu) ?? [])].filter((w) => !EX.has(w));
    const sinGlosa = tok.filter((w) => !global[w] && !capa[w]);
    const sinContexto = tok.filter((w) => (global[w] || capa[w]) && !capa[w]?.c);
    console.log(`${s.slug.padEnd(28)} tocables ${String(tok.length).padStart(3)} · sin glosa ${sinGlosa.length} · sin contexto ${sinContexto.length}`);
    if (sinGlosa.length) console.log("   SIN GLOSA:", sinGlosa.join(" "));
    if (sinContexto.length) console.log("   SIN CONTEXTO:", sinContexto.join(" "));
  }
  await p.$disconnect();
})();
