import { NextResponse } from "next/server";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { writeClient } from "@/sanity/lib/client";

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

type GenerateAudioBody = {
  documentId?: string;
  title?: string;
  text?: string;
  language?: string;
  region?: string;
};

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  try {
    let body: GenerateAudioBody;
    try {
      body = (await req.json()) as GenerateAudioBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "English";
    const region = typeof body.region === "string" ? body.region.trim() : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId. Save the draft once and try again." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!title) {
      return NextResponse.json(
        { error: "Missing title. Add a title before generating audio." },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!text) {
      return NextResponse.json(
        { error: "Missing text. Add story text before generating audio." },
        { status: 400, headers: corsHeaders }
      );
    }

    const audio = await generateAndUploadAudio(text, title, language, region || undefined);
    if (!audio?.url) {
      return NextResponse.json(
        { error: "Audio generation failed." },
        { status: 500, headers: corsHeaders }
      );
    }

    const patchData: Record<string, unknown> = {
      audioUrl: audio.url,
      audioQaStatus: audio.audioQa.status,
      audioQaScore: audio.audioQa.score,
      audioQaTranscript: audio.audioQa.transcript,
      audioQaNotes: audio.audioQa.notes.join("\n"),
      audioQaCheckedAt: new Date().toISOString(),
    };

    if (audio.assetId) {
      patchData.audio = {
        _type: "file",
        asset: { _type: "reference", _ref: audio.assetId },
      };
    }

    await writeClient.patch(documentId).set(patchData).commit({ autoGenerateArrayKeys: true });

    return NextResponse.json(
      {
        ok: true,
        audioAssetId: audio.assetId,
        url: audio.url,
        filename: audio.filename,
        audioQa: audio.audioQa,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[sanity/generate-audio] Failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate audio", details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
