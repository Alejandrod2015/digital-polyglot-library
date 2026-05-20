/**
 * One-shot: inserts a row into dp_studio_members. Idempotent — re-running
 * with the same email is a no-op.
 *
 * Run with: npx tsx scripts/addStudioMember.ts <email> <role> [name]
 *   role = admin | manager | content_creator
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const role = process.argv[3] as "admin" | "manager" | "content_creator" | undefined;
  const name = process.argv[4] ?? null;

  if (!email || !role) {
    console.error("Usage: npx tsx scripts/addStudioMember.ts <email> <role> [name]");
    process.exit(2);
  }
  if (!["admin", "manager", "content_creator"].includes(role)) {
    console.error(`Invalid role "${role}". Use admin | manager | content_creator.`);
    process.exit(2);
  }

  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();
  const existing = await prisma.studioMember.findUnique({ where: { email } });
  if (existing) {
    console.log(`Already exists: ${existing.email} [${existing.role}] ${existing.name ?? ""}`);
    await prisma.$disconnect();
    return;
  }
  const row = await prisma.studioMember.create({
    data: { email, role, name },
  });
  console.log(`Added: ${row.email} [${row.role}] ${row.name ?? ""}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
