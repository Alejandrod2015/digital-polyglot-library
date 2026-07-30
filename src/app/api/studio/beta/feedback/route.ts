// Feedback triage for /studio/beta. Admin only.
//
// PATCH → move one report through new -> triaged -> in_progress -> fixed, and
//         attach it to the release that fixed it. That attachment is what the
//         build note reads when it tells a tester their report shipped.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["new", "triaged", "in_progress", "fixed", "wont_fix", "duplicate"] as const;

export async function PATCH(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string; adminNotes?: string; releaseId?: string | null }
    | null;

  if (!body?.id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });

  if (body.status && !VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUS.join(", ")}` }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (typeof body.adminNotes === "string") data.adminNotes = body.adminNotes.trim() || null;

  if (body.releaseId !== undefined) {
    if (body.releaseId === null || body.releaseId === "") {
      data.releaseId = null;
    } else {
      const release = await prisma.betaRelease.findUnique({ where: { id: body.releaseId } });
      if (!release) return NextResponse.json({ error: "Release not found" }, { status: 404 });
      // Attaching a report to a build is the act of saying it is fixed there,
      // so the status follows automatically rather than needing two clicks
      // that can drift out of step.
      data.releaseId = body.releaseId;
      if (!body.status) data.status = "fixed";
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.betaFeedback.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, feedback: updated });
}

export async function DELETE(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });

  await prisma.betaFeedback.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
