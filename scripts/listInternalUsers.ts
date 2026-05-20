/**
 * Lists who will be excluded from the weekly digest as "internal":
 * everyone in dp_studio_members + anyone listed in METRICS_INTERNAL_EMAILS.
 *
 * Run with: npx tsx scripts/listInternalUsers.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();
  const studioRows = await prisma.studioMember.findMany({
    select: { email: true, role: true, name: true },
  });
  const envExtra = (process.env.METRICS_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  console.log("Studio members (auto-excluded):");
  if (!studioRows.length) console.log("  (none)");
  for (const row of studioRows) {
    console.log(`  - ${row.email}  [${row.role}]  ${row.name ?? ""}`);
  }
  console.log("");
  console.log("METRICS_INTERNAL_EMAILS env extras:");
  if (!envExtra.length) console.log("  (none)");
  for (const e of envExtra) console.log(`  - ${e}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
