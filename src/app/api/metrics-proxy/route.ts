// src/app/api/metrics-proxy/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<Response> {
  const { project_id, branch, query } = await req.json();

  if (!process.env.NEON_API_KEY) {
    return NextResponse.json({ error: "Missing NEON_API_KEY" }, { status: 500 });
  }

  try {
    const response = await fetch("https://console.neon.tech/api/v2/sql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NEON_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id,
        branch,
        query,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ Error in /api/metrics-proxy:", err);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
