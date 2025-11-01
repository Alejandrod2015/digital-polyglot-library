// src/app/api/metrics-proxy/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(req: NextRequest): Promise<Response> {
  const { query } = await req.json();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const result = await client.query(query);
    await client.end();
    return NextResponse.json({ rows: result.rows });
  } catch (err) {
    console.error("❌ Error in metrics-proxy:", err);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }
}
