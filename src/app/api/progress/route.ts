export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getProgressPayloadCached } from "@/lib/progressPayload";

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getProgressPayloadCached(userId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Error in GET /api/progress:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
