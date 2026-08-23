import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } } },
    select: { vocab: true, journey: { select: { typeSlug: true, name: true, variant: true, levels: true } } },
  });
  const byType = new Map<string, Set<string>>();
  const byJourney = new Map<string, Set<string>>();
  for (const r of rows) {
    const t = r.journey?.typeSlug ?? "?";
    const j = `${r.journey?.name} ${r.journey?.variant} ${JSON.stringify(r.journey?.levels)}`;
    if (!byType.has(t)) byType.set(t, new Set());
    if (!byJourney.has(j)) byJourney.set(j, new Set());
    for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) {
      if (v?.word) { byType.get(t)!.add(String(v.word).toLowerCase()); byJourney.get(j)!.add(String(v.word).toLowerCase()); }
    }
  }
  console.log("POR TIPO (lemas distintos):");
  for (const [t, s] of byType) console.log(`  ${t.padEnd(16)} ${s.size}`);
  console.log("\nPOR JOURNEY:");
  for (const [j, s] of byJourney) console.log(`  ${j.padEnd(40)} ${s.size}`);
  const all = new Set<string>(); for (const s of byType.values()) for (const w of s) all.add(w);
  console.log(`\nTOTAL distintos en spanish (no archived): ${all.size}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
