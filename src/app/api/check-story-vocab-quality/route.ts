import { NextResponse } from "next/server";
import { buildSanityCorsHeaders } from "@/lib/sanityCors";
import { assessStoryVocabQuality } from "@/lib/storyVocabQuality";

type Body = {
  text?: string;
  language?: string;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildSanityCorsHeaders(origin);

  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const text = stripHtml(typeof body.text === "string" ? body.text : "");
    if (!text || text.length < 120) {
      return NextResponse.json(
        { error: "Story text is too short to assess vocabulary quality." },
        { status: 400, headers: corsHeaders }
      );
    }

    const quality = assessStoryVocabQuality(text, typeof body.language === "string" ? body.language : undefined);
    return NextResponse.json({ quality }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in POST /api/check-story-vocab-quality:", error);
    return NextResponse.json(
      { error: "Failed to assess story vocabulary quality", details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildSanityCorsHeaders(origin),
  });
}

