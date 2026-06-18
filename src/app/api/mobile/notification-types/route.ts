export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { resolveNotificationTypes } from "@/lib/notifications";

// GET → the ordered set of active notification types with resolved copy,
// so the mobile Settings screen can render one toggle per type and the
// scheduler can use Studio-edited titles/bodies. Falls back to code
// defaults if the table is missing (migration not yet applied) so the
// app keeps working before/independently of the DB migration.
export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rows: Awaited<ReturnType<typeof prisma.notificationTypeConfig.findMany>> = [];
  try {
    rows = await prisma.notificationTypeConfig.findMany();
  } catch {
    rows = [];
  }

  const types = resolveNotificationTypes(rows);
  return NextResponse.json({ types });
}
