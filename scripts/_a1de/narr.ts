import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "german" } },
    select: { voiceId: true, journey: { select: { name: true, levels: true, status: true } } },
  });
  const tot = new Map<string, number>();
  const byJ = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const v = r.voiceId ?? "(sin voiceId)";
    tot.set(v, (tot.get(v) ?? 0) + 1);
    const k = `${r.journey?.name} ${JSON.stringify(r.journey?.levels)} ${r.journey?.status}`;
    if (!byJ.has(k)) byJ.set(k, new Map());
    byJ.get(k)!.set(v, (byJ.get(k)!.get(v) ?? 0) + 1);
  }
  console.log("TODOS los journeys alemanes (incluidos archivados):");
  for (const [v, n] of [...tot].sort((a, b) => b[1] - a[1])) console.log(`  ${v.padEnd(24)} ${n} historias`);
  console.log("\npor journey:");
  for (const [k, vs] of byJ) console.log(`  ${k.padEnd(34)} ${[...vs].map(([v, n]) => `${v} x${n}`).join(" · ")}`);
  await p.$disconnect();
})();
