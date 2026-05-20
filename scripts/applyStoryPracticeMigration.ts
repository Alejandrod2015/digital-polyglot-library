import { prisma } from "../src/lib/prisma";
import { readFileSync } from "fs";

async function main() {
  const sql = readFileSync(
    "prisma/migrations/20260517190000_add_story_practice_sets/migration.sql",
    "utf8"
  );
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  for (const stmt of statements) {
    console.log("→", stmt.slice(0, 90).replace(/\n/g, " "));
    try {
      const r = await prisma.$executeRawUnsafe(stmt);
      console.log("  OK rows=" + r);
    } catch (e) {
      console.error("  FAIL:", e instanceof Error ? e.message.slice(0, 250) : String(e));
    }
  }
  await prisma.$disconnect();
}

main();
