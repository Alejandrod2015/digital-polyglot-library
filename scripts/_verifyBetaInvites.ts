// Read-only: what WE recorded vs what APPLE holds, for the given emails.
// npx tsx scripts/_verifyBetaInvites.ts a@b.com c@d.com
import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

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

async function main() {
  const emails = process.argv.slice(2).map((e) => e.toLowerCase());
  const { PrismaClient } = await import("../src/generated/prisma");
  const { listGroupTesterStates } = await import("../src/lib/appStoreConnect");
  const prisma = new PrismaClient();

  const rows = await prisma.betaSignup.findMany({
    where: emails.length ? { email: { in: emails, mode: "insensitive" } } : { status: "invited" },
  });
  const appleStates = await listGroupTesterStates();
  console.log(`Apple returned ${appleStates.size} tester state(s)\n`);

  for (const r of rows) {
    const apple = r.ascTesterId ? appleStates.get(r.ascTesterId) : undefined;
    console.log(`${r.firstName ?? "?"} <${r.email}>`);
    console.log(`  ours    status=${r.status}  invitedAt=${r.invitedAt?.toISOString() ?? "never"}`);
    console.log(`  asc     testerId=${r.ascTesterId ?? "-"}  error=${r.ascError ?? "none"}`);
    console.log(`  apple   ${apple ? `${apple.state} (group ${apple.group})` : appleStates.size === 0 ? "UNREACHABLE" : "GONE / not in group"}`);
    console.log(`  plan    grantedAt=${r.planGrantedAt?.toISOString() ?? "-"}`);
    const emailsSent = await prisma.betaEmailLog.findMany({
      where: { signupId: r.id },
      orderBy: { sentAt: "asc" },
    });
    console.log(`  emails  ${emailsSent.map((e) => `${e.kind}@${e.sentAt.toISOString().slice(11, 19)}`).join(", ")}\n`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
