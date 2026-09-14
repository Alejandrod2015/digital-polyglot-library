// Personal reply to ONE feedback report, from /studio/beta. Admin only.
//
// POST { id, subject, body } → sends a plain personal note (no branding, see
// src/lib/emails/personal.ts) to the address the report came from, and stamps
// repliedAt / replySubject / replyText on the row so the queue shows what was
// said and when.
//
// Why this exists (2026-09-14): a tester wrote "the audio started late on word
// exercises that involved listening"; the fix shipped on the web the same day,
// and there was NO way to tell her. The build note only closes the loop for
// reports attached to a mobile release, and the "improvement" send is a batch
// that must be true on web, iOS and Android at once. Everything else was a
// hand-written email from the business inbox, which in practice meant silence.
//
// Deliberately narrow: the recipient is always the report's own email (never
// a free-text address), the text is sent verbatim, and nothing here changes
// the report's status. Replying is a conversation, not a triage step.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { requireBetaAdmin } from "@/lib/studioBetaAuth";
import { buildPersonalEmail } from "@/lib/emails/personal";

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 4000;
const MAX_SUBJECT_CHARS = 150;

export async function POST(req: NextRequest) {
  const check = await requireBetaAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { id?: string; subject?: string; body?: string }
    | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  if (!id) return NextResponse.json({ error: "Required: { id }" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is empty" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Reply is empty" }, { status: 400 });
  if (subject.length > MAX_SUBJECT_CHARS) {
    return NextResponse.json({ error: `Subject over ${MAX_SUBJECT_CHARS} characters` }, { status: 400 });
  }
  if (text.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: `Reply over ${MAX_BODY_CHARS} characters` }, { status: 400 });
  }

  const feedback = await prisma.betaFeedback.findUnique({
    where: { id },
    include: { signup: { select: { firstName: true } } },
  });
  if (!feedback) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });

  const to = feedback.email.trim().toLowerCase();
  if (!to.includes("@")) {
    return NextResponse.json({ error: "This report has no usable email address" }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return NextResponse.json({ error: "RESEND_API_KEY or EMAIL_FROM is not configured" }, { status: 500 });
  }

  // One paragraph per blank-line-separated block, sent as typed. The builder
  // adds the greeting from the signup's first name and the sign-off.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length > 0);

  const email = buildPersonalEmail({
    firstName: feedback.signup?.firstName ?? null,
    subject,
    paragraphs,
  });

  let providerId: string | undefined;
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Their answer lands where a person reads it, not in a no-reply void.
      replyTo: "support@digitalpolyglot.com",
      tags: [
        { name: "type", value: "transactional" },
        { name: "category", value: "beta-feedback-reply" },
      ],
    });
    providerId = result.data?.id;
  } catch (err) {
    console.error("[beta-feedback-reply] send failed:", err);
    return NextResponse.json({ error: "Sending failed; nothing was recorded" }, { status: 502 });
  }

  const updated = await prisma.betaFeedback.update({
    where: { id },
    data: {
      repliedAt: new Date(),
      replySubject: subject,
      replyText: paragraphs.join("\n\n"),
      replyProviderId: providerId ?? null,
    },
  });

  return NextResponse.json({ ok: true, feedback: updated });
}
