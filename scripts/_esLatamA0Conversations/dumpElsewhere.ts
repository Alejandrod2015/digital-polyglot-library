/** Vuelca a /tmp/elsewhere.json los lemas que ensenan otros journeys ES. Solo lee. */
import fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { variantPool } from "@domain/languageVariant";
const prisma = new PrismaClient();
(async () => {
  const JID = "cmub5my8d000432ye0v6pv5ng";
  const mio = await prisma.journey.findUnique({ where: { id: JID }, select: { language:true, typeSlug:true, variant:true } });
  const otras = await prisma.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: JID } },
    select: { vocab:true, journey: { select: { typeSlug:true, levels:true, variant:true } } } });
  const miPool = variantPool(mio!.variant);
  const PORT = new Set(["verb","adjective","adverb","expression"]);
  const out = new Set<string>();
  for (const r of otras) {
    const suyo = variantPool(r.journey?.variant);
    if (miPool && suyo && miPool !== suyo) continue;
    const mismoTipo = !!mio!.typeSlug && r.journey?.typeSlug === mio!.typeSlug;
    const mismoNivel = (r.journey?.levels ?? []).some((l) => String(l).toLowerCase() === "a0");
    for (const v of ((r.vocab as Array<{word?:unknown;type?:unknown}> | null) ?? [])) {
      if (!v?.word) continue;
      if (PORT.has(String(v.type ?? "").toLowerCase())) continue;
      if (mismoTipo && !mismoNivel) continue;
      out.add(String(v.word).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim());
    }
  }
  fs.writeFileSync("/tmp/elsewhere.json", JSON.stringify([...out]));
  console.log("lemas fuera:", out.size);
  await prisma.$disconnect();
})();
