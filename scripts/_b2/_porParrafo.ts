/** Por historia: pills por parrafo autorado y candidatos libres en cada uno. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const p = new PrismaClient();
(async () => {
  const file = process.argv[2], slugQ = process.argv[3];
  const stories = JSON.parse(fs.readFileSync(file, "utf8")) as any[];
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, vocab: true } });
  const slotsJourney = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab ?? []) as any[])) slotsJourney.add(norm(String(v.word)));
  for (const s of stories) {
    if (slugQ && s.slug !== slugQ) continue;
    const parr = String(s.text).split(/\n\s*\n/);
    const mios = new Set((s.vocab as any[]).map((v) => norm(String(v.word))));
    console.log(`\n### ${s.slug}`);
    parr.forEach((pa: string, i: number) => {
      const bajo = pa.toLowerCase();
      const pills = (s.vocab as any[]).filter((v) => bajo.includes(String(v.surface || v.word).toLowerCase()));
      const toks = [...new Set(bajo.match(/[a-záéíóúñü]{5,}/g) ?? [])]
        .filter((t) => isSpanishUpToLevel(t, "c1") && !slotsJourney.has(norm(t)) && !mios.has(norm(t)));
      console.log(`¶${i + 1} pills=${pills.length} [${pills.map((v) => v.word).join(", ")}]`);
      console.log(`     libres: ${toks.join(", ")}`);
    });
  }
  await p.$disconnect();
})();
