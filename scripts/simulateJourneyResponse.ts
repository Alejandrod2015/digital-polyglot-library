import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const userId = process.argv[2];
  if (!userId) { console.error("Pass userId"); process.exit(1); }

  // Mirror what the route does
  const metrics = await prisma.userMetric.findMany({
    where: { userId, eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { storySlug: true, eventType: true, metadata: true },
  });
  console.log(`Total audio metrics for ${userId}: ${metrics.length}`);
  for (const m of metrics.slice(0, 30)) {
    const md = m.metadata as Record<string, unknown> | null;
    const ratio = md?.progressSec && md?.audioDurationSec
      ? (md.progressSec as number) / (md.audioDurationSec as number)
      : null;
    console.log(`  ${m.eventType.padEnd(20)} ${m.storySlug}  progressKey=${md?.progressKey ?? "(none)"}  ratio=${ratio?.toFixed(3) ?? "n/a"}`);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
