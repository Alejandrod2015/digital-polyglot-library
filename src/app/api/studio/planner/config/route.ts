import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";
import {
  DEFAULT_PLANNER_CONFIG,
  invalidatePlannerConfigCache,
  loadPlannerConfig,
  PLANNER_CONFIG_KEY,
  sanitizePlannerConfig,
} from "@/agents/config/plannerConfig";

const studioConfig = (prisma as any).studioConfig;

async function getMember() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return null;

  const member = await getStudioMember(email);
  if (!member) return null;

  return { email, member };
}

async function requireAdmin() {
  const context = await getMember();
  if (!context) return { error: "Unauthorized", status: 401 } as const;
  if (context.member.role !== "admin") {
    return { error: "Forbidden: admin only", status: 403 } as const;
  }
  return context;
}

export async function GET() {
  const context = await getMember();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const row = await studioConfig.findUnique({ where: { key: PLANNER_CONFIG_KEY } });
    const config = await loadPlannerConfig();

    return NextResponse.json({
      source: row ? "database" : "defaults",
      config,
      defaults: DEFAULT_PLANNER_CONFIG,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
      canEdit: context.member.role === "admin",
    });
  } catch {
    return NextResponse.json({
      source: "defaults",
      config: DEFAULT_PLANNER_CONFIG,
      defaults: DEFAULT_PLANNER_CONFIG,
      updatedBy: null,
      updatedAt: null,
      canEdit: context.member.role === "admin",
    });
  }
}

export async function PUT(request: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  let body: { config?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.config) {
    return NextResponse.json({ error: "Missing 'config' in body" }, { status: 400 });
  }

  const config = sanitizePlannerConfig(body.config);

  try {
    const row = await studioConfig.upsert({
      where: { key: PLANNER_CONFIG_KEY },
      create: {
        key: PLANNER_CONFIG_KEY,
        value: config,
        updatedBy: check.email,
      },
      update: {
        value: config,
        updatedBy: check.email,
      },
    });

    invalidatePlannerConfigCache();

    return NextResponse.json({
      ok: true,
      source: "database",
      config,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
      canEdit: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save: ${message}` }, { status: 500 });
  }
}

export async function DELETE() {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    await studioConfig.delete({ where: { key: PLANNER_CONFIG_KEY } });
  } catch {
    // Ignore missing row.
  }

  invalidatePlannerConfigCache();

  return NextResponse.json({
    ok: true,
    source: "defaults",
    config: DEFAULT_PLANNER_CONFIG,
    canEdit: true,
  });
}
