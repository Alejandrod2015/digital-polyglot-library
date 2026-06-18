// Send a test push to ONLY the current admin's own device tokens.
// This is the safe way to validate the real APNs path end-to-end
// without sending to any other user. Admin only.

export const runtime = "nodejs";
export const maxDuration = 60;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStudioMember } from "@/lib/studio-access";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";

type StoredToken = { token?: unknown; provider?: unknown };

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  if (!isApnsConfigured()) {
    return NextResponse.json(
      { error: "APNs is not configured (missing APNS_* env vars)." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Test";
  const message =
    typeof body?.body === "string" && body.body.trim()
      ? body.body.trim()
      : "This is a test notification from Studio.";

  // Read THIS admin's own stored device tokens (set when they sign into
  // the iPhone app with the same account).
  const privateMeta = (user.privateMetadata as Record<string, unknown>) ?? {};
  const raw = privateMeta.mobilePushTokens;
  const tokens = Array.isArray(raw)
    ? (raw as StoredToken[])
        .filter((t) => t && typeof t === "object" && t.provider === "apns" && typeof t.token === "string")
        .map((t) => (t.token as string).trim())
        .filter(Boolean)
    : [];

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        error:
          "No device token found for your account. Sign into the iPhone app with this same account first.",
      },
      { status: 400 },
    );
  }

  const results = await sendApnsPush(tokens, { title, body: message, data: { test: true } });
  const delivered = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    deviceCount: tokens.length,
    delivered,
    failed: results.length - delivered,
    results: results.map((r) => ({ ok: r.ok, status: r.status, reason: r.reason })),
  });
}
