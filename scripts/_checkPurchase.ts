import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const claims = await prisma.claimToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("=== ÚLTIMOS 10 CLAIM TOKENS ===");
  for (const c of claims) {
    console.log(
      JSON.stringify({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        buyerEmail: c.buyerEmail,
        recipientEmail: c.recipientEmail,
        books: c.books,
        redeemedBy: c.redeemedBy,
        redeemedAt: c.redeemedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        remindersSent: c.remindersSent,
        token: c.token,
      })
    );
  }

  console.log("\n=== ÚLTIMAS 10 ENTITLEMENTS ===");
  const ents = await prisma.billingEntitlement.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const e of ents) {
    console.log(
      JSON.stringify({
        userId: e.userId,
        plan: e.plan,
        source: e.source,
        status: e.status,
        productId: e.productId,
        orderId: e.orderId,
        startedAt: e.startedAt.toISOString(),
        expiresAt: e.expiresAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
