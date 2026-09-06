import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const W = ["hoja","prisa","basura","mojado","grifo","duro","prometer","tono","contrato","documento","sello","plazo","acuerdo","condición"];
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, status: { not: "archived" } },
    select: { id: true, typeSlug: true, variant: true, levels: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { journeyId: true, vocab: true } });
  const donde = new Map<string, Set<string>>();
  for (const r of rows) {
    const j = js.find((x) => x.id === r.journeyId)!;
    if (j.id === "cmt5x67ze000l320cpgunu5vi") continue;
    for (const v of ((r.vocab as Array<{ word: string; type?: string }>) ?? []))
      if (W.includes(v.word.toLowerCase()))
        (donde.get(v.word.toLowerCase()) ?? donde.set(v.word.toLowerCase(), new Set()).get(v.word.toLowerCase())!)
          .add(`${j.typeSlug}/${j.variant}/${(j.levels ?? []).join("")} [${v.type}]`);
  }
  for (const w of W) console.log(w.padEnd(12), [...(donde.get(w) ?? ["LIBRE"])].join(" · "));
  await p.$disconnect();
})();
