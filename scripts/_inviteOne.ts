// Invites ONE applicant by email: adds them to the TestFlight beta group and
// sends them the acceptance email. Gated by guard 6f like every other send.
//
//   APP_BASE_URL=https://digitalpolyglot.com npx tsx scripts/_inviteOne.ts <email>

import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const email = process.argv[2];
// Optional hand-written line that goes INSIDE the acceptance email. Stored on
// the applicant first, so a resend carries the same words.
const note = process.argv[3]?.trim() || null;
if (!email) {
  console.error('usage: tsx scripts/_inviteOne.ts <email> ["personal note"]');
  process.exit(1);
}

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { inviteApplicant } = await import("../src/lib/betaProgram");
  const prisma = new PrismaClient();

  const s = await prisma.betaSignup.findFirst({ where: { email } });
  if (!s) {
    console.log(`no applicant with email ${email}`);
    await prisma.$disconnect();
    return;
  }
  if (note) {
    await prisma.betaSignup.update({ where: { id: s.id }, data: { personalNote: note } });
    console.log(`note      : "${note}"`);
  }
  console.log(`link base : ${process.env.APP_BASE_URL}`);
  console.log(`before    : status=${s.status}  appleId=${s.appleIdEmail}`);

  const r = await inviteApplicant(s.id);
  console.log(`result    : invited=${r.invited} status=${r.status} email=${r.emailed} error=${r.error ?? "-"}`);

  const after = await prisma.betaSignup.findUnique({
    where: { id: s.id },
    select: { status: true, ascTesterId: true, invitedAt: true, ascError: true },
  });
  console.log(`after     : ${JSON.stringify(after)}`);
  await prisma.$disconnect();
})();
