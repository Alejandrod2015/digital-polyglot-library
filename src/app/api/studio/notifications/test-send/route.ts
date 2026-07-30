// Send a test push to ONLY the current admin's own device tokens.
// This is the safe way to validate the real APNs (iOS) and FCM (Android)
// paths end-to-end without sending to any other user. Admin only.

export const runtime = "nodejs";
export const maxDuration = 60;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStudioMember } from "@/lib/studio-access";
import { isApnsConfigured, sendApnsPush } from "@/lib/apnsPush";
import { isFcmConfigured, sendFcmPush } from "@/lib/fcmPush";
import { classifyStoredToken, type StoredToken } from "@/lib/pushRecipients";

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

  const apnsReady = isApnsConfigured();
  const fcmReady = isFcmConfigured();
  if (!apnsReady && !fcmReady) {
    return NextResponse.json(
      { error: "No push transport is configured (missing APNS_* and FCM_* env vars)." },
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
  // the app with the same account, on iPhone or Android).
  const privateMeta = (user.privateMetadata as Record<string, unknown>) ?? {};
  const raw = privateMeta.mobilePushTokens;
  const stored = Array.isArray(raw) ? (raw as StoredToken[]) : [];
  const apnsTokens: string[] = [];
  const fcmTokens: string[] = [];
  for (const entry of stored) {
    const transport = classifyStoredToken(entry);
    if (!transport) continue;
    const value = (entry.token as string).trim();
    if (transport === "apns") apnsTokens.push(value);
    else fcmTokens.push(value);
  }

  if (apnsTokens.length + fcmTokens.length === 0) {
    return NextResponse.json(
      {
        error:
          "No device token found for your account. Sign into the mobile app with this same account first.",
      },
      { status: 400 },
    );
  }

  const payload = { title, body: message, data: { test: true } };
  const skipped = (tokens: string[], label: string) =>
    tokens.map((token) => ({
      token,
      ok: false as const,
      status: 0,
      reason: `${label} not configured`,
    }));

  const [apnsResults, fcmResults] = await Promise.all([
    apnsTokens.length > 0 && apnsReady
      ? sendApnsPush(apnsTokens, payload)
      : Promise.resolve(skipped(apnsReady ? [] : apnsTokens, "APNs")),
    fcmTokens.length > 0 && fcmReady
      ? sendFcmPush(fcmTokens, payload)
      : Promise.resolve(skipped(fcmReady ? [] : fcmTokens, "FCM")),
  ]);

  // Etiquetar por transporte: con un iPhone y un Android en la misma cuenta,
  // "1 delivered, 1 failed" a secas no dice cuál de los dos falló.
  const results = [
    ...apnsResults.map((r) => ({ ...r, transport: "apns" as const })),
    ...fcmResults.map((r) => ({ ...r, transport: "fcm" as const })),
  ];
  const delivered = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: true,
    deviceCount: results.length,
    delivered,
    failed: results.length - delivered,
    results: results.map((r) => ({
      transport: r.transport,
      ok: r.ok,
      status: r.status,
      reason: r.reason,
    })),
  });
}
