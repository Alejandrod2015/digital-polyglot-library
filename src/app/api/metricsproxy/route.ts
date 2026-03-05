export const runtime = "nodejs";

import { NextResponse } from "next/server";

const DEPRECATED_MESSAGE =
  "metricsproxy is disabled for security reasons. Use /api/metrics/aggregate.";

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: DEPRECATED_MESSAGE }, { status: 410 });
}

export async function POST(): Promise<Response> {
  return NextResponse.json({ error: DEPRECATED_MESSAGE }, { status: 410 });
}
