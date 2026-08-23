import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmqfnp3tf000032afygkqp8z2";
(async () => {
  const mio = await p.journey.findUnique({ where: { id: A1 }, select: { language: true, typeSlug: true, levels: true, variant: true, status: true, name: true } });
  console.log("JOURNEY", JSON.stringify(mio));
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: A1 } },
    select: { vocab: true, journey: { select: { typeSlug: true, id: true, levels: true, name: true } } },
  });
  const duro = new Map<string, Set<string>>();
  const blando = new Set<string>();
  for (const r of otras) {
    const same = r.journey?.typeSlug === mio!.typeSlug;
    for (const v of ((r.vocab as any[]) ?? [])) {
      if (!v?.word) continue;
      if (same) {
        if (!duro.has(String(v.word))) duro.set(String(v.word), new Set());
        duro.get(String(v.word))!.add(r.journey!.id + ":" + (r.journey!.levels ?? []).join("/"));
      } else blando.add(String(v.word));
    }
  }
  console.log("SAME_TYPE", duro.size, "ELSEWHERE", blando.size);
  console.log("SAME_TYPE_LIST", JSON.stringify([...duro.keys()].sort()));
  console.log("ELSEWHERE_LIST", JSON.stringify([...blando].sort()));
  await p.$disconnect();
})();
