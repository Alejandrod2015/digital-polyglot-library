// One-off: apply ONLY the beta_program migration, statement by statement.
//
// `prisma migrate deploy` is not usable here for two reasons: it cannot take
// its advisory lock against the Neon pooled URL (the repo already documents
// this in /api/studio/apply-pending-migrations), and it would drag in two
// unrelated pending migrations whose features are already live in production.
//
// Every statement in the file is idempotent, so re-running is a no-op.
//
//   npx tsx scripts/_applyBetaMigration.ts prisma/migrations/20260730120000_beta_program/migration.sql

import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const MIGRATION = process.argv[2];
if (!MIGRATION) {
  console.error("usage: tsx scripts/_applyBetaMigration.ts <path-to-migration.sql>");
  process.exit(1);
}

/** Split on statement-terminating semicolons, dropping comment-only lines. */
function statements(sql: string): string[] {
  const stripped = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const sql = readFileSync(MIGRATION, "utf8");
  const stmts = statements(sql);
  console.log(`Applying ${stmts.length} statements from ${MIGRATION}\n`);

  for (const [i, stmt] of stmts.entries()) {
    const label = stmt.replace(/\s+/g, " ").slice(0, 88);
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  ok   [${i + 1}/${stmts.length}] ${label}`);
    } catch (err) {
      console.error(`  FAIL [${i + 1}/${stmts.length}] ${label}`);
      console.error(`       ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // Verify the shape rather than trusting that no statement threw.
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'dp_beta_signups_v1' ORDER BY ordinal_position;`,
  );
  const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('dp_beta_email_log_v1','dp_beta_feedback_v1','dp_beta_releases_v1')
      ORDER BY table_name;`,
  );

  console.log("\nBetaSignup columns:\n  " + cols.map((c) => c.column_name).join(", "));
  console.log("New tables: " + (tables.map((t) => t.table_name).join(", ") || "(none)"));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err);
    process.exit(1);
  });
