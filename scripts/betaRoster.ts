// The beta roster: who applied, who is in, who actually opened the app.
//
// Read-only. Joins three sources that each know a different part of the truth:
//   - BetaSignup      what we decided about them
//   - App Store Connect  whether Apple has them and whether they installed
//   - UserMetric      whether they have done anything since
//
// A tester can be `invited` with us and INSTALLED at Apple and still have zero
// usage: that gap is the whole point of the table.
//
//   npx tsx scripts/betaRoster.ts

import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const TEST_ROW = /betatest|postmigration|example\.com/;

const b64 = (v: Buffer | string) =>
  (typeof v === "string" ? Buffer.from(v) : v).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function jwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" }));
  const p = b64(JSON.stringify({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" }));
  const pem = process.env.ASC_PRIVATE_KEY || readFileSync(process.env.ASC_PRIVATE_KEY_PATH!, "utf8");
  const s = sign("SHA256", Buffer.from(`${h}.${p}`), {
    key: createPrivateKey({ key: pem, format: "pem" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${h}.${p}.${b64(s)}`;
}

type AppleTester = { email: string; name: string; state: string; group: string };

async function appleTesters(): Promise<AppleTester[]> {
  const H = { Authorization: `Bearer ${jwt()}` };
  const base = "https://api.appstoreconnect.apple.com";
  const groups = await (await fetch(`${base}/v1/apps/${process.env.ASC_APP_ID}/betaGroups?limit=200`, { headers: H })).json();
  const out: AppleTester[] = [];
  for (const g of groups.data ?? []) {
    const t = await (await fetch(`${base}/v1/betaGroups/${g.id}/betaTesters?limit=200`, { headers: H })).json();
    for (const x of t.data ?? []) {
      const a = x.attributes ?? {};
      out.push({
        email: (a.email ?? "").toLowerCase(),
        name: [a.firstName, a.lastName].filter(Boolean).join(" ").trim(),
        state: a.state ?? "?",
        group: g.attributes?.name ?? "?",
      });
    }
  }
  return out;
}

function pad(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const prisma = new PrismaClient();

  const [signups, apple] = await Promise.all([
    prisma.betaSignup.findMany({
      orderBy: [{ status: "asc" }, { score: "desc" }],
      include: { _count: { select: { feedback: true } } },
    }),
    appleTesters().catch((e) => {
      console.error("App Store Connect unreachable:", e instanceof Error ? e.message : e);
      return [] as AppleTester[];
    }),
  ]);

  const real = signups.filter((s) => !TEST_ROW.test(s.email));
  const byEmail = new Map(apple.map((a) => [a.email, a]));

  const userIds = real.map((s) => s.clerkUserId).filter((x): x is string => Boolean(x));
  const events = userIds.length
    ? await prisma.userMetric.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const usage = new Map(events.map((e) => [e.userId, e]));

  const head = [
    pad("NOMBRE", 14), pad("EMAIL", 32), pad("IDIOMA/NIVEL", 20),
    pad("PROGRAMA", 10), pad("TESTFLIGHT", 12), pad("ENTRO", 7),
    pad("USO", 8), "FEEDBACK",
  ].join(" ");
  console.log(head);
  console.log("-".repeat(head.length));

  for (const s of real) {
    const a = byEmail.get((s.appleIdEmail ?? s.email).toLowerCase()) ?? byEmail.get(s.email.toLowerCase());
    const u = s.clerkUserId ? usage.get(s.clerkUserId) : undefined;
    console.log([
      pad(s.firstName ?? "-", 14),
      pad(s.email, 32),
      pad(`${s.targetLanguage} ${s.currentLevel}`, 20),
      pad(s.status, 10),
      pad(a ? a.state : "no está", 12),
      pad(s.clerkUserId ? "sí" : "no", 7),
      pad(u ? String(u._count._all) : "0", 8),
      String(s._count.feedback),
    ].join(" "));
  }

  // Anyone Apple knows about who never came through the form. They get no
  // build notes, no surveys and no review ask: the program cannot see them.
  const known = new Set(real.flatMap((s) => [s.email.toLowerCase(), (s.appleIdEmail ?? "").toLowerCase()]));
  const orphans = apple.filter((a) => !known.has(a.email));
  if (orphans.length) {
    console.log(`\nEn TestFlight pero FUERA del programa (${orphans.length}):`);
    for (const o of orphans) {
      console.log(`  ${pad(o.name, 24)} ${pad(o.email, 34)} ${pad(o.state, 12)} ${o.group}`);
    }
  }

  await prisma.$disconnect();
})();
