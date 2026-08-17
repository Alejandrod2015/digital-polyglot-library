import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  for (const jid of process.argv.slice(2)) {
    const j = await prisma.journey.findUnique({ where: { id: jid } });
    const a = j as unknown as Record<string, unknown>;
    const st = await prisma.journeyStory.findMany({
      where: { journeyId: jid },
      select: { slug: true, status: true, topic: true, slotIndex: true, wordCount: true, audioUrl: true, coverUrl: true, practiceSet: { select: { id: true } } },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    });
    console.log(`\n===== ${a.name} · ${a.language}/${a.variant} · ${JSON.stringify(a.levels)} · ${a.status} (${jid}) =====`);
    const byStatus = new Map<string, number>();
    for (const s of st) byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    console.log(`  status: ${[...byStatus].map(([k, v]) => `${k}=${v}`).join(", ")}`);
    console.log(`  con texto: ${st.filter((s) => (s.wordCount ?? 0) > 0).length}/${st.length}  con audio: ${st.filter((s) => s.audioUrl).length}  con cover: ${st.filter((s) => s.coverUrl).length}  con práctica: ${st.filter((s) => s.practiceSet).length}`);
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
