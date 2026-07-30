// End-to-end smoke test for the beta program, with no outward-facing side
// effects: the triage engine is exercised in DRY mode (scores only, never
// invites or emails), and the feedback row written by the API test is deleted
// again before the script exits.
//
//   npx tsx scripts/_testBetaProgram.ts

import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { evaluateApplication, DEFAULT_BETA_RULES } from "../src/lib/betaRules";

// Next reads .env.local with precedence over .env; Prisma's loader only reads
// .env. CLERK_SECRET_KEY lives only in .env.local, and it is what the token
// signing falls back to, so without this the script signs with a different
// secret than the server verifies with and every valid token looks forged.
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue; // first file wins, like Next
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

const prisma = new PrismaClient();
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

// Mirrors emailToken() in src/lib/emailPreferences.ts, which cannot be
// imported here: it pulls in prisma and through it `server-only`. Duplicated
// deliberately, and it doubles as a check that the signing scheme is what the
// route actually expects.
function emailToken(email: string): string {
  const secret =
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dpl-email-unsubscribe-secret";
  const encoded = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

async function getBetaRules() {
  const row = await prisma.studioConfig.findUnique({ where: { key: "beta_rules_v1" } });
  const stored = (row?.value ?? null) as Partial<typeof DEFAULT_BETA_RULES> | null;
  return { ...DEFAULT_BETA_RULES, ...(stored ?? {}) };
}

async function testRulesDry() {
  console.log("── Triage engine, dry run over the real applications ──\n");
  const rules = await getBetaRules();
  const activeTesterCount = await prisma.betaSignup.count({
    where: { status: { in: ["invited", "accepted"] } },
  });
  console.log(`Rules: accept>=${rules.autoAcceptAt}, decline<${rules.autoDeclineBelow}, cap ${rules.maxActiveTesters}, active ${activeTesterCount}\n`);

  const rows = await prisma.betaSignup.findMany({ orderBy: { createdAt: "asc" } });
  for (const r of rows) {
    const v = evaluateApplication(
      {
        email: r.email,
        appleIdEmail: r.appleIdEmail,
        platform: r.platform,
        hasIPhone: r.hasIPhone,
        targetLanguage: r.targetLanguage,
        nativeLanguage: r.nativeLanguage,
        currentLevel: r.currentLevel,
        weeklyHours: r.weeklyHours,
        motivation: r.motivation,
        referralSource: r.referralSource,
        applicationReason: r.applicationReason,
        socialHandle: r.socialHandle,
      },
      rules,
      { activeTesterCount },
    );
    console.log(`${v.decision.padEnd(12)} ${String(v.score).padStart(3)}  ${r.email}`);
    console.log(`             ${v.reason}`);
  }
}

async function testFeedbackApi() {
  console.log("\n── Public feedback API ──\n");

  const bad = await fetch(`${BASE}/api/beta/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "forged.signature", kind: "bug", message: "should not land" }),
  });
  console.log(`  forged token          -> ${bad.status} ${bad.status === 401 ? "(rejected, correct)" : "(WRONG)"}`);

  const empty = await fetch(`${BASE}/api/beta/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: emailToken("nobody@example.com"), kind: "bug", message: "x" }),
  });
  console.log(`  message too short     -> ${empty.status} ${empty.status === 400 ? "(rejected, correct)" : "(WRONG)"}`);

  // A real signup, so the row links up the way it would in production.
  const subject = await prisma.betaSignup.findFirst({
    where: { email: { contains: "test-postmigration" } },
    select: { id: true, email: true },
  });
  if (!subject) {
    console.log("  no test signup to use; skipping the happy path");
    return;
  }

  const ok = await fetch(`${BASE}/api/beta/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: emailToken(subject.email),
      kind: "final_survey",
      rating: 9,
      message: "Smoke test from scripts/_testBetaProgram.ts",
    }),
  });
  const json = (await ok.json().catch(() => ({}))) as { id?: string; error?: string };
  console.log(`  valid token           -> ${ok.status} ${ok.status === 201 ? "(accepted, correct)" : `(WRONG: ${json.error})`}`);

  if (json.id) {
    const row = await prisma.betaFeedback.findUnique({ where: { id: json.id } });
    console.log(`  row linked to signup  -> ${row?.signupId === subject.id ? "yes" : "NO"}`);
    console.log(`  rating stored         -> ${row?.rating}`);
    await prisma.betaFeedback.delete({ where: { id: json.id } });
    console.log(`  cleaned up            -> deleted`);
  }
}

async function main() {
  await testRulesDry();
  await testFeedbackApi();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err);
    process.exit(1);
  });
