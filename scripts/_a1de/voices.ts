import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "german", status: { not: "archived" } } },
    select: { voiceId: true, journey: { select: { name: true, levels: true, variant: true } } },
  });
  const m = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = `${r.journey?.name} ${r.journey?.variant} ${JSON.stringify(r.journey?.levels)}`;
    if (!m.has(k)) m.set(k, new Map());
    const v = r.voiceId ?? "(sin voiceId)";
    m.get(k)!.set(v, (m.get(k)!.get(v) ?? 0) + 1);
  }
  for (const [k, vs] of m) {
    console.log(k);
    for (const [v, n] of vs) console.log(`   ${v}  x${n}`);
  }
  await p.$disconnect();
})();
