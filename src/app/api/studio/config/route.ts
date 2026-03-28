import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";
import { PEDAGOGICAL_RULES } from "@/agents/config/pedagogicalConfig";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const studioConfig = (prisma as any).studioConfig;

const CONFIG_KEY = "pedagogical_rules";

/** Verify the caller is a studio admin. */
async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return { error: "Unauthorized", status: 401 } as const;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return { error: "Unauthorized", status: 401 } as const;

  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return { error: "Forbidden: admin only", status: 403 } as const;
  }

  return { email, member } as const;
}

/**
 * GET /api/studio/config
 * Returns the pedagogical rules. Falls back to hardcoded defaults if no DB entry.
 */
export async function GET() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const row = await studioConfig.findUnique({ where: { key: CONFIG_KEY } });

    if (row) {
      return NextResponse.json({
        source: "database",
        rules: row.value,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt,
      });
    }

    // No custom config yet — return defaults
    return NextResponse.json({
      source: "defaults",
      rules: PEDAGOGICAL_RULES,
      updatedBy: null,
      updatedAt: null,
    });
  } catch {
    // Table might not exist yet — return defaults
    return NextResponse.json({
      source: "defaults",
      rules: PEDAGOGICAL_RULES,
      updatedBy: null,
      updatedAt: null,
    });
  }
}

/**
 * PUT /api/studio/config
 * Save pedagogical rules to DB.
 * Body: { rules: Record<string, PedagogicalRule> }
 */
export async function PUT(request: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { rules?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.rules || typeof body.rules !== "object") {
    return NextResponse.json({ error: "Missing 'rules' object in body" }, { status: 400 });
  }

  // Validate that all 6 CEFR levels are present
  const requiredLevels = ["a1", "a2", "b1", "b2", "c1", "c2"];
  const missingLevels = requiredLevels.filter((l) => !(l in body.rules!));
  if (missingLevels.length > 0) {
    return NextResponse.json(
      { error: `Missing CEFR levels: ${missingLevels.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate each level has required fields
  for (const level of requiredLevels) {
    const rule = body.rules[level] as Record<string, unknown> | undefined;
    if (!rule) continue;

    const requiredFields = ["wordCountRange", "sentenceComplexity", "grammarStructures", "vocabDensity", "vocabType", "toneGuidance"];
    const missing = requiredFields.filter((f) => !(f in rule));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Level ${level.toUpperCase()} is missing fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }
  }

  try {
    const row = await studioConfig.upsert({
      where: { key: CONFIG_KEY },
      create: {
        key: CONFIG_KEY,
        value: body.rules,
        updatedBy: check.email,
      },
      update: {
        value: body.rules,
        updatedBy: check.email,
      },
    });

    return NextResponse.json({
      ok: true,
      source: "database",
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE /api/studio/config
 * Reset to defaults (deletes DB entry).
 */
export async function DELETE() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    await studioConfig.delete({ where: { key: CONFIG_KEY } });
  } catch {
    // Already deleted or doesn't exist
  }

  return NextResponse.json({ ok: true, source: "defaults" });
}
