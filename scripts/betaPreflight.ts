// Readiness check for the beta program. Run it before opening the gate, and
// again any time something stops working.
//
//   npx tsx scripts/betaPreflight.ts
//   npx tsx scripts/betaPreflight.ts --create-group
//
// Read-only by default. `--create-group` is the single exception and it only
// ever creates the external TestFlight group when it is missing.
//
// Every failure line says what to do about it. A preflight that reports
// "something is wrong" without naming the fix just moves the work.

import { existsSync, readFileSync } from "node:fs";

// Next reads .env.local ahead of .env; nothing loads it for a bare script.
// Without this the check would report missing keys that are in fact set, which
// is the worst possible failure mode for a tool whose whole job is to tell you
// what is missing.
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

import { PrismaClient } from "../src/generated/prisma";
import {
  isAscConfigured,
  listBetaGroups,
  ensureBetaGroup,
  listRecentBuilds,
  listBuildsForGroup,
} from "../src/lib/appStoreConnect";
import { DEFAULT_BETA_RULES, type BetaRulesConfig } from "../src/lib/betaRules";

const prisma = new PrismaClient();
const CREATE_GROUP = process.argv.includes("--create-group");

type Check = { name: string; ok: boolean; detail: string; fix?: string; blocking: boolean };
const checks: Check[] = [];

function add(c: Check) {
  checks.push(c);
}

function envSet(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

async function checkEnv() {
  // The private key may arrive inline or as a path to the .p8; either counts.
  const hasKeyMaterial = envSet("ASC_PRIVATE_KEY") || envSet("ASC_PRIVATE_KEY_PATH");
  const missing = ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_APP_ID"].filter((k) => !envSet(k));
  if (!hasKeyMaterial) missing.push("ASC_PRIVATE_KEY or ASC_PRIVATE_KEY_PATH");
  add({
    name: "App Store Connect credentials",
    ok: missing.length === 0,
    detail: missing.length === 0 ? "all four set" : `missing ${missing.join(", ")}`,
    fix: "Create a key with the App Manager role in App Store Connect > Users and Access > Integrations, then add the four values to .env.local and to Vercel.",
    blocking: true,
  });

  add({
    name: "Email sending",
    ok: envSet("RESEND_API_KEY") && envSet("EMAIL_FROM"),
    detail: envSet("RESEND_API_KEY") && envSet("EMAIL_FROM") ? "Resend configured" : "missing RESEND_API_KEY or EMAIL_FROM",
    fix: "Without these no beta email is ever sent; sendBetaEmail() returns 'skipped' silently.",
    blocking: true,
  });

  // A localhost value is worse than an unset one: unset falls back to the real
  // domain, while localhost ships dead links to real inboxes. Locally that is
  // expected and harmless, so it is a warning rather than a block, but it must
  // never be silent.
  const baseUrl = process.env.APP_BASE_URL?.trim() ?? "";
  const baseIsLocal = /localhost|127\.0\.0\.1/.test(baseUrl);
  add({
    name: "Email link base",
    ok: baseUrl.length > 0 && !baseIsLocal,
    detail: !baseUrl
      ? "not set, falling back to https://digitalpolyglot.com"
      : baseIsLocal
        ? `${baseUrl} (fine locally, but any email sent from this shell carries dead links)`
        : baseUrl,
    fix: "On Vercel, APP_BASE_URL must be the public host. Never send real beta emails from a shell where it points at localhost.",
    blocking: false,
  });

  const apns = ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_AUTH_KEY", "APNS_BUNDLE_ID"].every(envSet);
  add({
    name: "Push for build notes",
    ok: apns,
    detail: apns ? "APNs configured" : "APNs not fully configured",
    fix: "Build notes still go out by email; only the push nudge is skipped.",
    blocking: false,
  });

  add({
    name: "Cron authentication",
    ok: envSet("CRON_SECRET"),
    detail: envSet("CRON_SECRET") ? "set" : "not set, the cron endpoint is open",
    fix: "Set CRON_SECRET so /api/cron/beta-lifecycle cannot be triggered by anyone.",
    blocking: false,
  });
}

async function checkDatabase() {
  try {
    const [signups, feedback, releases, logs] = await Promise.all([
      prisma.betaSignup.count(),
      prisma.betaFeedback.count(),
      prisma.betaRelease.count(),
      prisma.betaEmailLog.count(),
    ]);
    add({
      name: "Database schema",
      ok: true,
      detail: `${signups} applicants, ${feedback} feedback, ${releases} releases, ${logs} emails logged`,
      blocking: true,
    });
  } catch (err) {
    add({
      name: "Database schema",
      ok: false,
      detail: String(err instanceof Error ? err.message : err),
      fix: "Apply prisma/migrations/20260730120000_beta_program via scripts/_applyBetaMigration.ts.",
      blocking: true,
    });
  }
}

async function checkRules() {
  const row = await prisma.studioConfig.findUnique({ where: { key: "beta_rules_v1" } }).catch(() => null);
  const rules: BetaRulesConfig = { ...DEFAULT_BETA_RULES, ...((row?.value as Partial<BetaRulesConfig>) ?? {}) };

  add({
    name: "Triage thresholds",
    ok: rules.autoDeclineBelow <= rules.autoAcceptAt && rules.maxActiveTesters > 0,
    detail: `accept >= ${rules.autoAcceptAt}, decline < ${rules.autoDeclineBelow}, cap ${rules.maxActiveTesters}${row ? "" : " (defaults, never saved)"}`,
    fix: "Fix them in the Rules tab of /studio/beta.",
    blocking: true,
  });

  add({
    name: "Recruiting languages",
    ok: rules.acceptedTargetLanguages.length > 0,
    detail: rules.acceptedTargetLanguages.join(", ") || "none, so every application queues",
    fix: "Set at least one language in the Rules tab.",
    blocking: true,
  });

  add({
    name: "Auto-invite switch",
    ok: rules.autoInviteEnabled,
    detail: rules.autoInviteEnabled ? "on" : "off, every application waits for you",
    fix: "Turn it on in the Rules tab when you want the program to run itself.",
    blocking: false,
  });

  // Not blocking before the first tester, but silently unset dates are how a
  // program reaches its end and simply never asks anybody anything.
  add({
    name: "End-of-beta date",
    ok: Boolean(rules.betaEndsAt),
    detail: rules.betaEndsAt ? new Date(rules.betaEndsAt).toISOString().slice(0, 10) : "not set, the final survey will never fire",
    fix: "Set it in the Rules tab once you know roughly when the beta closes.",
    blocking: false,
  });
}

async function checkAppleConnection() {
  if (!isAscConfigured()) {
    add({
      name: "TestFlight connection",
      ok: false,
      detail: "skipped, credentials are missing",
      fix: "Fix the credentials check above first.",
      blocking: true,
    });
    return;
  }

  let groups: Awaited<ReturnType<typeof listBetaGroups>> = [];
  try {
    groups = await listBetaGroups();
    add({
      name: "TestFlight connection",
      ok: true,
      detail: `authenticated, ${groups.length} group(s) visible`,
      blocking: true,
    });
  } catch (err) {
    add({
      name: "TestFlight connection",
      ok: false,
      detail: String(err instanceof Error ? err.message : err),
      fix: "Check the key has the App Manager role and that ASC_APP_ID is 6760942737.",
      blocking: true,
    });
    return;
  }

  if (CREATE_GROUP) {
    const result = await ensureBetaGroup();
    add({
      name: "External beta group",
      ok: result.ok,
      detail: result.ok
        ? `${result.name}${result.created ? " (created just now)" : " (already existed)"}`
        : result.error,
      fix: "Rename the clashing group, or set ASC_BETA_GROUP_NAME to the name you want.",
      blocking: true,
    });
  } else {
    const wanted = (process.env.ASC_BETA_GROUP_NAME?.trim() || "Beta Testers").toLowerCase();
    const match = groups.find((g) => g.name.toLowerCase() === wanted);
    add({
      name: "External beta group",
      ok: Boolean(match && !match.internal),
      detail: !match
        ? `no group named "${wanted}"`
        : match.internal
          ? `"${match.name}" exists but is internal, so public applicants cannot join it`
          : `"${match.name}" ready`,
      fix: "Re-run this with --create-group to create it over the API.",
      blocking: true,
    });
  }

  // What matters is not that a build exists on the app, but that THIS group can
  // install one. A build uploaded without a group assignment is invisible to
  // testers, and the difference is silent on both sides.
  const wantedName = (process.env.ASC_BETA_GROUP_NAME?.trim() || "Beta Testers").toLowerCase();
  const target = groups.find((g) => g.name.toLowerCase() === wantedName && !g.internal);

  try {
    const appBuilds = await listRecentBuilds(5);
    const groupBuilds = target ? await listBuildsForGroup(target.id) : [];
    const live = groupBuilds.filter((b) => !b.expired);
    const newestOnApp = appBuilds.find((b) => !b.expired && b.processingState === "VALID");
    const newestInGroup = live
      .map((b) => Number(b.version))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)[0];

    const behind =
      newestOnApp && newestInGroup !== undefined && Number(newestOnApp.version) > newestInGroup;

    add({
      name: "Build the group can install",
      ok: live.length > 0 && !behind,
      detail: !target
        ? "no external group to check"
        : live.length === 0
          ? "NONE. An invited tester would accept and find nothing to install"
          : behind
            ? `group has ${live.map((b) => b.version).join(", ")}, but build ${newestOnApp?.version} exists on the app`
            : `group can install ${live.map((b) => b.version).join(", ")}`,
      fix: "In App Store Connect, open the build and add the external group under TestFlight, or upload a newer build and assign it. The first build of a new version also needs Beta App Review.",
      blocking: true,
    });

    add({
      name: "Builds on the app",
      ok: appBuilds.length > 0,
      detail:
        appBuilds.length === 0
          ? "none uploaded"
          : appBuilds
              .map((b) => `${b.version}${b.expired ? " (expired)" : ""}${b.processingState !== "VALID" ? ` (${b.processingState})` : ""}`)
              .join(", "),
      fix: "Upload a build. TestFlight builds expire 90 days after upload.",
      blocking: false,
    });
  } catch (err) {
    add({
      name: "Build the group can install",
      ok: false,
      detail: String(err instanceof Error ? err.message : err),
      fix: "The key may lack permission to read builds.",
      blocking: true,
    });
  }
}

async function main() {
  await checkEnv();
  await checkDatabase();
  await checkRules();
  await checkAppleConnection();

  console.log("\nBETA PROGRAM PREFLIGHT\n");
  for (const c of checks) {
    const mark = c.ok ? "PASS" : c.blocking ? "BLOCK" : "warn ";
    console.log(`  ${mark}  ${c.name.padEnd(28)} ${c.detail}`);
    if (!c.ok && c.fix) console.log(`         ${" ".repeat(28)} -> ${c.fix}`);
  }

  const blocking = checks.filter((c) => !c.ok && c.blocking);
  const warnings = checks.filter((c) => !c.ok && !c.blocking);

  console.log("");
  if (blocking.length === 0) {
    console.log(`READY. ${warnings.length} non-blocking warning(s).`);
  } else {
    console.log(`NOT READY. ${blocking.length} blocking item(s), ${warnings.length} warning(s).`);
  }
  process.exitCode = blocking.length === 0 ? 0 : 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err);
    process.exit(1);
  });
