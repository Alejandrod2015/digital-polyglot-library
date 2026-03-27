import { NextRequest, NextResponse } from "next/server";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getProgressPayloadCached } from "@/lib/progressPayload";

export async function GET(req: NextRequest) {
  const session = await getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getProgressPayloadCached(session.sub);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error in GET /api/mobile/progress:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
