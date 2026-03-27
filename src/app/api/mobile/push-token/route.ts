export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

type MobilePushTokenRecord = {
  token: string;
  provider: string;
  platform: string;
  deviceName: string | null;
  updatedAt: string;
};

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

function isPushTokenRecordArray(value: unknown): value is MobilePushTokenRecord[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.token === "string" &&
        typeof record.provider === "string" &&
        typeof record.platform === "string" &&
        (typeof record.deviceName === "string" || record.deviceName === null) &&
        typeof record.updatedAt === "string"
      );
    })
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        token?: string;
        provider?: string;
        platform?: string;
        deviceName?: string | null;
      }
    | null;

  const token = body?.token?.trim() ?? "";
  const provider = body?.provider?.trim() ?? "";
  const platform = body?.platform?.trim() ?? "";
  const deviceName = body?.deviceName?.trim() ?? null;

  if (!token || !provider || !platform) {
    return NextResponse.json({ error: "Missing push token payload." }, { status: 400 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const privateMetadata = user.privateMetadata ?? {};
  const currentTokens = isPushTokenRecordArray(privateMetadata.mobilePushTokens)
    ? privateMetadata.mobilePushTokens
    : [];

  const nextRecord: MobilePushTokenRecord = {
    token,
    provider,
    platform,
    deviceName,
    updatedAt: new Date().toISOString(),
  };

  const deduped = currentTokens.filter((item) => item.token !== token);
  const nextTokens = [nextRecord, ...deduped].slice(0, 12);

  await clerkClient.users.updateUserMetadata(session.sub, {
    privateMetadata: {
      ...privateMetadata,
      mobilePushTokens: nextTokens,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim() ?? "";

  if (!token) {
    return NextResponse.json({ error: "Missing push token." }, { status: 400 });
  }

  const user = await clerkClient.users.getUser(session.sub);
  const privateMetadata = user.privateMetadata ?? {};
  const currentTokens = isPushTokenRecordArray(privateMetadata.mobilePushTokens)
    ? privateMetadata.mobilePushTokens
    : [];

  await clerkClient.users.updateUserMetadata(session.sub, {
    privateMetadata: {
      ...privateMetadata,
      mobilePushTokens: currentTokens.filter((item) => item.token !== token),
    },
  });

  return NextResponse.json({ ok: true });
}
