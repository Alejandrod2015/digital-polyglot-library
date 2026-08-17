import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const userId = process.argv[2];

async function run() {
  const evs = await prisma.userMetric.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  console.log(`=== EVENTOS (${evs.length}) ===`);
  for (const e of evs) {
    const m = (e.metadata ?? {}) as Record<string, unknown>;
    const keys = Object.entries(m)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" ");
    console.log(
      `${e.createdAt.toISOString()}  ${e.eventType.padEnd(22)} book=${(e.bookSlug ?? "-").padEnd(28)} story=${e.storySlug.padEnd(42)} val=${e.value ?? "-"}  ${keys}`,
    );
  }

  console.log(`\n=== CONTINUE LISTENING ===`);
  const cont = await prisma.continueListeningEntry.findMany({
    where: { userId },
    orderBy: { lastPlayedAt: "desc" },
  });
  for (const c of cont) {
    console.log(
      `${c.lastPlayedAt.toISOString()}  ${c.bookSlug} / ${c.storySlug}  ${c.progressSec ?? "-"}s de ${c.audioDurationSec ?? "-"}s`,
    );
  }
  if (!cont.length) console.log("(ninguno)");

  console.log(`\n=== BILLING ===`);
  const bill = await prisma.billingEntitlement.findUnique({ where: { userId } });
  console.log(bill ? { plan: bill.plan, source: bill.source, status: bill.status, startedAt: bill.startedAt, expiresAt: bill.expiresAt } : "(sin entitlement -> free)");

  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
