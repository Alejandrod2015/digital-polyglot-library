// Invite named beta applicants to TestFlight. SENDS REAL EMAIL to real people.
//
// Named so the command string itself contains `inviteApplicant`: guard 6f in
// pre-bash-guard.sh scans the COMMAND, not the file, so a neutral filename
// would have walked this straight past the outbound-email gate. The gate is
// the point, not an obstacle.
//
//   npx tsx scripts/_inviteApplicantBeta.ts a@b.com c@d.com
//   npx tsx scripts/_inviteApplicantBeta.ts --dry a@b.com   (shows, sends nothing)

import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

// betaProgram pulls in prisma, which imports `server-only`. That module exists
// to throw outside a server component, so a plain script cannot load the chain
// without stubbing it. Production code is untouched. Same shim as
// scripts/_runBetaTriage.ts.
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

async function main() {
  const emails = process.argv
    .slice(2)
    .filter((a) => !a.startsWith("--"))
    .map((e) => e.toLowerCase());

  if (emails.length === 0) {
    console.error("Usage: npx tsx scripts/_inviteApplicantBeta.ts [--dry] <email> [email...]");
    process.exit(1);
  }

  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();

  const rows = await prisma.betaSignup.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
  });

  const missing = emails.filter((e) => !rows.some((r) => r.email.toLowerCase() === e));
  if (missing.length > 0) {
    console.error(`Not found: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`link base : ${process.env.APP_BASE_URL ?? "https://digitalpolyglot.com (default)"}`);
  console.log(`mode      : ${DRY ? "DRY, nothing sent" : "LIVE, real email"}\n`);

  for (const r of rows) {
    console.log(`${r.firstName ?? "?"} <${r.email}>  status=${r.status} score=${r.score ?? "-"} platform=${r.platform ?? "ios"}`);
    if (DRY) {
      console.log("  --dry: would invite to TestFlight and send the acceptance email. Nothing sent.\n");
      continue;
    }
    // Imported lazily so --dry never even loads the sender.
    const { inviteApplicant } = await import("../src/lib/betaProgram");
    const outcome = await inviteApplicant(r.id);
    console.log(
      `  -> invited=${outcome.invited} status=${outcome.status} emailed=${outcome.emailed} error=${outcome.error ?? "none"}\n`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
