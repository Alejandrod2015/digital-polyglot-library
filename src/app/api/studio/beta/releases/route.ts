// Build notes for /studio/beta. Admin only.
//
// POST   → create a draft release
// PATCH  → edit a draft
// PUT    → publish it, which mails and pushes every active tester
// DELETE → drop a draft
//
// Publishing is the only outward-facing action in the beta surface, so it is
// deliberately its own verb rather than a `status` field you could flip by
// accident while editing the headline.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";
import { publishRelease } from "@/lib/betaReleases";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function stringList(v: unknown, max = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

export async function POST(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const version = typeof body.version === "string" ? body.version.trim() : "";
  const buildNumber = typeof body.buildNumber === "string" ? body.buildNumber.trim() : "";
  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  const whatsNew = stringList(body.whatsNew);

  if (!version || !buildNumber || !headline) {
    return NextResponse.json(
      { error: "Required: version, buildNumber, headline" },
      { status: 400 },
    );
  }
  if (whatsNew.length === 0) {
    return NextResponse.json({ error: "List at least one change" }, { status: 400 });
  }

  const platform = body.platform === "android" ? "android" : "ios";

  const existing = await prisma.betaRelease.findUnique({
    where: { platform_buildNumber: { platform, buildNumber } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Build ${buildNumber} already exists for ${platform}` },
      { status: 409 },
    );
  }

  const release = await prisma.betaRelease.create({
    data: {
      platform,
      version,
      buildNumber,
      headline,
      whatsNew,
      knownIssues: stringList(body.knownIssues),
      askThem: typeof body.askThem === "string" ? body.askThem.trim() || null : null,
      createdByEmail: check.email,
    },
  });

  return NextResponse.json({ ok: true, release }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Required: { id }" }, { status: 400 });
  }

  const existing = await prisma.betaRelease.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });
  if (existing.status === "published") {
    // The note is already in people's inboxes; editing the record afterwards
    // would only make the Studio disagree with what was actually sent.
    return NextResponse.json({ error: "A published release cannot be edited" }, { status: 409 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.version === "string" && body.version.trim()) data.version = body.version.trim();
  if (typeof body.headline === "string" && body.headline.trim()) data.headline = body.headline.trim();
  if (body.whatsNew !== undefined) {
    const list = stringList(body.whatsNew);
    if (list.length === 0) return NextResponse.json({ error: "List at least one change" }, { status: 400 });
    data.whatsNew = list;
  }
  if (body.knownIssues !== undefined) data.knownIssues = stringList(body.knownIssues);
  if (body.askThem !== undefined) {
    data.askThem = typeof body.askThem === "string" ? body.askThem.trim() || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const release = await prisma.betaRelease.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, release });
}

export async function PUT(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });

  const result = await publishRelease(body.id, check.email);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function DELETE(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });

  const existing = await prisma.betaRelease.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Release not found" }, { status: 404 });
  if (existing.status === "published") {
    return NextResponse.json({ error: "A published release cannot be deleted" }, { status: 409 });
  }

  await prisma.betaRelease.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
