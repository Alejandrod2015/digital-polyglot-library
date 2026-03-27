/**
 * Seed the initial studio members into the database.
 *
 * Run with:
 *   npx tsx prisma/seed-studio-members.ts
 */

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const INITIAL_MEMBERS = [
  { email: "delcarpio321@gmail.com", role: "admin" as const, name: "Alejandro" },
  { email: "jazdigital19@gmail.com", role: "content_creator" as const, name: null },
  { email: "fatimamalcadp@gmail.com", role: "manager" as const, name: null },
];

async function main() {
  for (const member of INITIAL_MEMBERS) {
    const existing = await prisma.studioMember.findUnique({
      where: { email: member.email },
    });

    if (existing) {
      console.log(`  ⏭  ${member.email} already exists (${existing.role})`);
    } else {
      await prisma.studioMember.create({ data: member });
      console.log(`  ✅ ${member.email} added as ${member.role}`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
