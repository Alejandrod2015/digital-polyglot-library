// Admin endpoint for the Studio "Efectividad" tab. Admin only.
// GET ?range=7d|30d|all → notification effectiveness across both channels
// (local daily reminder funnel + push campaign open rates + recent activity).

export const runtime = "nodejs";
export const maxDuration = 60;

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStudioMember } from "@/lib/studio-access";
import {
  getNotificationEffectiveness,
  type EffectivenessRange,
} from "@/lib/notificationEffectiveness";

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
  return { email } as const;
}

function parseRange(value: string | null): EffectivenessRange {
  return value === "7d" || value === "all" ? value : "30d";
}

export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const data = await getNotificationEffectiveness(range);
  return NextResponse.json(data);
}
