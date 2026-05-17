// One-shot admin endpoint to apply the BetaSignup column additions
// (motivation, applicationReason, attribution) directly via raw SQL.
//
// Background: we tried wiring `prisma migrate deploy` into the Vercel
// build but it fails when DATABASE_URL points to Neon's pooled URL
// (PgBouncer doesn't support the advisory locks Prisma uses for its
// migration lock). To avoid making the user copy a non-pooled URL into
// Vercel envs, we just apply this one migration as raw idempotent DDL
// from inside the app (where Prisma's own connection is happy).
//
// Idempotent: uses ADD COLUMN IF NOT EXISTS. Safe to call multiple
// times. Once you confirm /beta submissions work, this file can be
// deleted in a follow-up commit.

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

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "dp_beta_signups_v1"
      ADD COLUMN IF NOT EXISTS "motivation" TEXT,
      ADD COLUMN IF NOT EXISTS "applicationReason" TEXT,
      ADD COLUMN IF NOT EXISTS "attribution" JSONB;
  `);

  // Sanity check: read back the column list so the caller sees what's
  // in the table now.
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'dp_beta_signups_v1'
    ORDER BY ordinal_position;
  `);

  return NextResponse.json({
    ok: true,
    columns: cols.map((c) => c.column_name),
  });
}

// GET returns the current column list without mutating (still admin-gated)
// so you can verify state from a browser without crafting a POST.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'dp_beta_signups_v1'
    ORDER BY ordinal_position;
  `);

  return NextResponse.json({
    ok: true,
    columns: cols.map((c) => c.column_name),
  });
}
