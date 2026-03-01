import { NextResponse } from "next/server";
import OpenAI from "openai";
import { writeClient } from "@/sanity/lib/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type GenerateCoverBody = {
  documentId?: string;
  title?: string;
  synopsis?: string;
  language?: string;
  region?: string;
  topic?: string;
  level?: string;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeFileChunk(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    let body: GenerateCoverBody;
    try {
      body = (await req.json()) as GenerateCoverBody;
    } catch {
      return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
    }

    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const synopsisRaw = typeof body.synopsis === "string" ? body.synopsis.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "";
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const level = typeof body.level === "string" ? body.level.trim() : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId. Save the draft once and try again." },
        { status: 400 }
      );
    }

    if (!synopsisRaw) {
      return NextResponse.json(
        { error: "Missing synopsis. Add a synopsis (or story text) before generating the cover." },
        { status: 400 }
      );
    }

    const synopsis = stripHtml(synopsisRaw).slice(0, 1600);
    const contextLine = [
      language ? `Language: ${language}.` : "",
      region ? `Region: ${region}.` : "",
      level ? `Level: ${level}.` : "",
      topic ? `Topic: ${topic}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const prompt = [
      "Ilustracion minimalista.",
      "Dimensiones 1536 x 1024.",
      "Basa la ilustracion en la siguiente sinopsis.",
      synopsis,
      contextLine,
      "Sin texto, sin logos, sin marcos. Composicion limpia.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = (await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
    })) as unknown;

    const imageBase64 =
      typeof result === "object" &&
      result !== null &&
      Array.isArray((result as { data?: unknown[] }).data) &&
      typeof (result as { data: Array<{ b64_json?: unknown }> }).data[0]?.b64_json === "string"
        ? ((result as { data: Array<{ b64_json: string }> }).data[0].b64_json as string)
        : null;

    if (!imageBase64) {
      return NextResponse.json({ error: "No image data returned from OpenAI." }, { status: 502 });
    }

    const fileBase = sanitizeFileChunk(title || "story-cover");
    const filename = `${fileBase || "story-cover"}-${Date.now()}.png`;
    const buffer = Buffer.from(imageBase64, "base64");

    const asset = await writeClient.assets.upload("image", buffer, {
      filename,
      contentType: "image/png",
    });

    await writeClient.patch(documentId).set({
      cover: {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: asset._id,
        },
      },
    }).commit({ autoGenerateArrayKeys: true });

    return NextResponse.json({
      ok: true,
      assetId: asset._id,
      url: typeof asset.url === "string" ? asset.url : null,
      filename,
    });
  } catch (error) {
    console.error("[sanity/generate-cover] Failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate cover", details: message }, { status: 500 });
  }
}

