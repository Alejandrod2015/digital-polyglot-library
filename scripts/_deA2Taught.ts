/** Replica el calculo de taughtElsewhere/taughtSameType de saveStory para el Friends DE A2. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { variantPool } from "@domain/languageVariant";
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const JID = "cmubidgaf0007j8np6g7n89iu";
(async () => {
  const mio = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true, variant: true, language: true } });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: "german" }, journeyId: { not: JID } },
    select: { vocab: true, journey: { select: { typeSlug: true, variant: true, levels: true } } },
  });
  const PORTABLES = new Set(["verb", "adjective", "adverb", "expression"]);
  const miPool = variantPool(mio!.variant);
  const out = new Set<string>(), duro = new Set<string>();
  for (const r of otras) {
    const suyo = variantPool(r.journey?.variant);
    if (miPool && suyo && miPool !== suyo) continue;
    const mismoTipo = !!mio!.typeSlug && r.journey?.typeSlug === mio!.typeSlug;
    const mismoNivel = (r.journey?.levels ?? []).some((l) => String(l).toLowerCase() === "a2");
    for (const v of ((r.vocab as any[]) ?? [])) {
      if (!v?.word) continue;
      if (PORTABLES.has(String(v.type ?? "").toLowerCase())) continue;
      if (mismoTipo && !mismoNivel) continue;
      (mismoTipo ? duro : out).add(String(v.word));
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify({ taughtElsewhere: [...out].sort(), taughtSameType: [...duro].sort() }, null, 1));
  console.log(`elsewhere=${out.size} sameType=${duro.size}`);
  await p.$disconnect();
})();
