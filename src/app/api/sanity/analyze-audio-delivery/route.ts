import { NextResponse } from "next/server";
import { analyzeExistingAudioDelivery, buildAudioNarrationText } from "@/lib/elevenlabs";
import { writeClient } from "@/sanity/lib/client";
import { sanityWriteClient } from "@/sanity";

const ALLOWED_ORIGINS = new Set([
  "https://www.sanity.io",
  "http://localhost:3000",
  "http://localhost:3333",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3333",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".sanity.studio");
  } catch {
    return false;
  }
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = isAllowedOrigin(origin) ? origin : "https://www.sanity.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

type AnalyzeAudioBody = {
  documentId?: string;
  title?: string;
  text?: string;
};

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

async function getDocumentAudioUrl(documentId: string): Promise<string | null> {
  const publishedId = documentId.replace(/^drafts\./, "");
  const draftId = documentId.startsWith("drafts.") ? documentId : `drafts.${documentId}`;

  const query = `
    *[_id in [$documentId, $publishedId, $draftId]][0]{
      "audioUrl": audio.asset->url
    }
  `;

  const result = await sanityWriteClient.fetch<{ audioUrl?: string | null } | null>(query, {
    documentId,
    publishedId,
    draftId,
  });

  return typeof result?.audioUrl === "string" && result.audioUrl.trim() ? result.audioUrl.trim() : null;
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  try {
    const body = (await req.json()) as AnalyzeAudioBody;
    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId. Save the draft once and try again." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!title) {
      return NextResponse.json(
        { error: "Missing title. Add a title before analyzing delivery." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "Missing text. Add story text before analyzing delivery." },
        { status: 400, headers: corsHeaders }
      );
    }

    const audioUrl = await getDocumentAudioUrl(documentId);
    if (!audioUrl) {
      return NextResponse.json(
        { error: "No audio file is attached to this document yet." },
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(audioUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to download the existing audio file for delivery analysis." },
        { status: 502, headers: corsHeaders }
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const expectedNarration = buildAudioNarrationText(title, text);
    const audioDeliveryQa = await analyzeExistingAudioDelivery(audioBuffer, expectedNarration, title);

    await writeClient
      .patch(documentId)
      .set({
        audioDeliveryQaStatus: audioDeliveryQa.status,
        audioDeliveryQaScore: audioDeliveryQa.score,
        audioDeliveryQaNotes: audioDeliveryQa.notes.join("\n"),
        audioDeliveryQaCheckedAt: new Date().toISOString(),
      })
      .commit({ autoGenerateArrayKeys: true });

    return NextResponse.json(
      {
        ok: true,
        audioDeliveryQa,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[sanity/analyze-audio-delivery] Failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to analyze delivery", details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
