import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const recent = await prisma.userMetric.findMany({
    where: { eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { userId: true, eventType: true, storySlug: true, bookSlug: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  console.log(`Recent audio_complete/continue_listening: ${recent.length}`);
  const byUser = new Map<string, number>();
  for (const m of recent) {
    byUser.set(m.userId, (byUser.get(m.userId) ?? 0) + 1);
  }
  for (const [u, c] of byUser) console.log(`  ${u}: ${c}`);
  console.log("---");
  for (const m of recent.slice(0, 25)) {
    const md = m.metadata as Record<string, unknown> | null;
    const pk = md?.progressKey ?? "(none)";
    console.log(`  ${m.createdAt.toISOString()} ${m.userId.slice(0,15)}.. ${m.eventType.padEnd(20)} slug=${m.storySlug} pk=${pk}`);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
