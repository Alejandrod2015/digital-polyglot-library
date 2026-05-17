// One-shot admin endpoint to apply pending raw-SQL migrations directly,
// bypassing `prisma migrate deploy` which can't acquire its advisory
// lock against the Neon pooled URL we use in production.
//
// Each block is idempotent (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF
// NOT EXISTS). Safe to POST multiple times. Returns the post-mutation
// column list per relevant table so the caller can verify state.
//
// Add a new block here when you need to ship a schema change that
// `prisma migrate deploy` can't apply on its own.

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 403 });
  }
  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

async function tableColumns(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
       WHERE table_name = '${table}'
     ORDER BY ordinal_position;`,
  );
  return rows.map((r) => r.column_name);
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables WHERE table_name = '${table}'
     ) AS exists;`,
  );
  return Boolean(rows[0]?.exists);
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // ── 2026-05-17: BetaSignup gained motivation, applicationReason,
  // attribution. The form-side code already references these, so the
  // /beta endpoint will 500 until this is applied.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "dp_beta_signups_v1"
      ADD COLUMN IF NOT EXISTS "motivation" TEXT,
      ADD COLUMN IF NOT EXISTS "applicationReason" TEXT,
      ADD COLUMN IF NOT EXISTS "attribution" JSONB;
  `);

  // ── 2026-05-18: First-party visit log. See PageVisit in
  // schema.prisma. Server-side, no consent banner needed.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dp_page_visits_v1" (
      "id"              TEXT PRIMARY KEY,
      "path"            TEXT NOT NULL,
      "referrer"        TEXT,
      "landingUrl"      TEXT,
      "utmSource"       TEXT,
      "utmMedium"       TEXT,
      "utmCampaign"     TEXT,
      "utmContent"      TEXT,
      "utmTerm"         TEXT,
      "country"         TEXT,
      "region"          TEXT,
      "city"            TEXT,
      "timezone"        TEXT,
      "browserLanguage" TEXT,
      "deviceCategory"  TEXT,
      "userAgent"       TEXT,
      "ipHashed"        TEXT,
      "sessionId"       TEXT,
      "preConsent"      BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_createdAt_idx" ON "dp_page_visits_v1" ("createdAt");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_path_idx" ON "dp_page_visits_v1" ("path");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_sessionId_idx" ON "dp_page_visits_v1" ("sessionId");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_country_idx" ON "dp_page_visits_v1" ("country");`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "dp_page_visits_v1_utmSource_idx" ON "dp_page_visits_v1" ("utmSource");`,
  );

  return NextResponse.json({
    ok: true,
    betaSignupColumns: await tableColumns("dp_beta_signups_v1"),
    pageVisitColumns: await tableColumns("dp_page_visits_v1"),
    pageVisitsExists: await tableExists("dp_page_visits_v1"),
  });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    betaSignupColumns: await tableColumns("dp_beta_signups_v1"),
    pageVisitColumns: await tableColumns("dp_page_visits_v1"),
    pageVisitsExists: await tableExists("dp_page_visits_v1"),
  });
}
