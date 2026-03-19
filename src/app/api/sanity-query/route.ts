import { NextRequest, NextResponse } from "next/server";
import { createClient } from "next-sanity";

export const runtime = "nodejs";

type Body = {
  query?: string;
  params?: Record<string, unknown>;
};

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-05";

const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  perspective: "raw",
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as Body;
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const params = body.params && typeof body.params === "object" ? body.params : {};

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const result = await sanity.fetch(query, params);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[sanity-query] Failed:", error);
    return NextResponse.json({ error: "Failed to execute Sanity query" }, { status: 500 });
  }
}
