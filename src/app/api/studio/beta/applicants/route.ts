// Applicant actions for /studio/beta. Admin only.
//
// POST → one action against one applicant: invite, decline, waitlist, retriage
//        (re-run the rules), remove (pull TestFlight access), or note.
//
// Every action is the same code path the automation uses, so a manual invite
// and an automatic one produce identical state. There is no second, sloppier
// path for the human.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";
import {
  inviteApplicant,
  declineApplicant,
  waitlistApplicant,
  processApplication,
  removeTesterAccess,
} from "@/lib/betaProgram";

export const dynamic = "force-dynamic";

const ACTIONS = ["invite", "decline", "waitlist", "retriage", "remove", "note"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; action?: string; notes?: string }
    | null;

  if (!body?.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Required: { id, action }" }, { status: 400 });
  }
  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${ACTIONS.join(", ")}` }, { status: 400 });
  }

  const existing = await prisma.betaSignup.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Applicant not found" }, { status: 404 });

  try {
    switch (action) {
      case "invite": {
        const result = await inviteApplicant(body.id);
        // A failed Apple call is reported as a 502, not swallowed as a 200:
        // an invite that silently did nothing is the one failure mode that
        // would quietly starve the program.
        if (!result.invited) {
          return NextResponse.json({ ok: false, ...result }, { status: 502 });
        }
        return NextResponse.json({ ok: true, ...result });
      }

      case "decline":
        return NextResponse.json({
          ok: true,
          emailed: await declineApplicant(body.id, "Declined from Studio"),
        });

      case "waitlist":
        return NextResponse.json({ ok: true, emailed: await waitlistApplicant(body.id) });

      case "retriage":
        return NextResponse.json({ ok: true, outcome: await processApplication(body.id) });

      case "remove": {
        const result = await removeTesterAccess(body.id, { revokePlan: true });
        return NextResponse.json(result, { status: result.ok ? 200 : 502 });
      }

      case "note": {
        const notes = typeof body.notes === "string" ? body.notes.trim() : "";
        const updated = await prisma.betaSignup.update({
          where: { id: body.id },
          data: { notes: notes || null },
        });
        return NextResponse.json({ ok: true, applicant: updated });
      }
    }
  } catch (err) {
    console.error(`❌ Beta applicant action "${action}" failed:`, err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// Spam cleanup. Feedback rows survive (their signup link goes null) so a
// deleted application never takes real bug reports with it.
export async function DELETE(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });

  await prisma.betaSignup.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
