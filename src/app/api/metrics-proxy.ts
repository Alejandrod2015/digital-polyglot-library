export const runtime = "nodejs";

import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch("https://api.neon.tech/sql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}
