import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const email = (process.argv[2] || "").toLowerCase();

async function run() {
  const [beta, claimsBuyer, claimsRecipient, pref] = await Promise.all([
    prisma.betaSignup.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }),
    prisma.claimToken.findMany({ where: { buyerEmail: { equals: email, mode: "insensitive" } } }),
    prisma.claimToken.findMany({ where: { recipientEmail: { equals: email, mode: "insensitive" } } }),
    prisma.emailPreference.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }),
  ]);

  console.log("=== BETA SIGNUP ===");
  if (beta) {
    console.log({
      status: beta.status,
      target: beta.targetLanguage,
      level: beta.currentLevel,
      native: beta.nativeLanguage,
      createdAt: beta.createdAt,
      invitedAt: beta.invitedAt,
      referral: beta.referralSource,
      firstName: beta.firstName,
    });
  } else console.log("(ninguno)");

  console.log("\n=== CLAIM TOKENS (compra de libro) ===");
  for (const c of [...claimsBuyer, ...claimsRecipient]) {
    console.log({ books: c.books, redeemedBy: c.redeemedBy, redeemedAt: c.redeemedAt, createdAt: c.createdAt });
  }
  if (!claimsBuyer.length && !claimsRecipient.length) console.log("(ninguno)");

  console.log("\n=== EMAIL PREFERENCE (userId) ===");
  console.log(pref ? { userId: pref.userId, createdAt: pref.createdAt } : "(ninguno)");

  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
