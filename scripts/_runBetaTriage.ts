// Runs the triage engine over the pending applications and carries out the
// verdicts, which means it SENDS REAL EMAIL. Not a dry run.
//
//   APP_BASE_URL=https://digitalpolyglot.com npx tsx scripts/_runBetaTriage.ts
//   ... --dry     to see the verdicts without acting on them
//
// Test rows (the +betatest / postmigration / example.com addresses) are always
// skipped: they are fixtures, not people, and mailing them is noise.

import { createRequire } from "node:module";
import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

// betaProgram pulls in prisma, which imports `server-only`. That module exists
// to throw outside a server component, so a plain script cannot load the chain
// without stubbing it. Production code is untouched.
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry");
const TEST_ROW = /betatest|postmigration|example\.com/;

async function main() {
  const require2 = createRequire(import.meta.url);
  void require2;
  const { PrismaClient } = await import("../src/generated/prisma");
  const { processApplication } = await import("../src/lib/betaProgram");
  const prisma = new PrismaClient();

  const pending = await prisma.betaSignup.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  const real = pending.filter((r) => !TEST_ROW.test(r.email));

  console.log(`link base : ${process.env.APP_BASE_URL}`);
  console.log(`pending   : ${pending.length}  (${pending.length - real.length} test rows skipped)`);
  console.log(`mode      : ${DRY ? "DRY, nothing sent" : "LIVE, real email"}\n`);

  for (const row of real) {
    if (DRY) {
      console.log(`${row.email.padEnd(34)} (dry)`);
      continue;
    }
    try {
      const o = await processApplication(row.id);
      console.log(
        `${row.email.padEnd(34)} ${o.decision.padEnd(13)} score=${String(o.score).padStart(3)}  status=${o.status.padEnd(9)} email=${o.emailed}`,
      );
    } catch (err) {
      console.log(`${row.email.padEnd(34)} ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
