import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const journeys = await prisma.journey.findMany({ where: { status: "active" }, select: { id: true, name: true, variant: true, language: true } });
  for (const j of journeys) {
    const rows = await prisma.journeyStory.findMany({
      where: { journeyId: j.id },
      select: { level: true, topic: true, slotIndex: true, slug: true, status: true },
      orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    });
    const levels = new Set(rows.map(r => r.level));
    console.log(`\n\n===== JOURNEY ${j.name} | ${j.language}/${j.variant} | id=${j.id} | levels=${[...levels].join(",")} =====`);
    // status tally
    const statusTally: Record<string, number> = {};
    for (const r of rows) statusTally[r.status] = (statusTally[r.status] || 0) + 1;
    console.log("total rows:", rows.length, "| by status:", JSON.stringify(statusTally));
    // published per topic
    const pub = rows.filter(r => r.status === "published");
    console.log(`PUBLISHED total: ${pub.length}`);
    const byTopic = new Map<string, any[]>();
    for (const r of pub) { const k = `${r.level}/${r.topic}`; if (!byTopic.has(k)) byTopic.set(k, []); byTopic.get(k)!.push(r); }
    for (const [k, arr] of byTopic) {
      console.log(`  ${k.padEnd(45)} ${arr.length} slots: [${arr.map(a => a.slotIndex).join(",")}]`);
    }
    // non-published detail
    const nonPub = rows.filter(r => r.status !== "published");
    if (nonPub.length) {
      console.log(`  --- NON-published (${nonPub.length}) ---`);
      for (const r of nonPub) console.log(`    [${r.status}] ${r.level}/${r.topic} slot${r.slotIndex} ${r.slug || ""}`);
    }
  }
  await prisma.$disconnect();
})();
