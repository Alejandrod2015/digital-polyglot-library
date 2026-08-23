import { prisma } from "../src/lib/prisma";
async function main() {
  const rows = await prisma.betaSignup.findMany({
    where: { email: { in: ["delcarpio321@gmail.com", "admin@digitalpolyglot.com", "digitalpolyglots@gmail.com"] } },
    select: { email: true, clerkUserId: true, createdAt: true },
  });
  console.log(rows);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
