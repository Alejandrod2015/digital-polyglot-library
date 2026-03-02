import { NextResponse } from "next/server";
import OpenAI from "openai";
import { writeClient } from "@/sanity/lib/client";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
    let body: GenerateCoverBody;
    try {
      body = (await req.json()) as GenerateCoverBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400, headers: corsHeaders }
      );
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
        { status: 400, headers: corsHeaders }
      );
    }

    if (!synopsisRaw) {
      return NextResponse.json(
        { error: "Missing synopsis. Add a synopsis (or story text) before generating the cover." },
        { status: 400, headers: corsHeaders }
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
      "Ilustracion editorial minimalista y moderna.",
      "Formato horizontal 1536x1024.",
      "Estilo visual: minimalista con color realista y natural.",
      "Prioriza color local creible de cada elemento (piel, cielo, ropa, calles, edificios).",
      "White balance neutro de luz diurna (aprox 5200K-6000K).",
      "Saturacion media a media-alta: colores un poco mas vivos, sin apariencia chillona.",
      "Color grading limpio y sutil: sin veladura beige ni wash sepia/ambar.",
      "Tonos de piel, ropa, calles y edificios deben verse creibles y fisicos.",
      "Iluminacion y sombras suaves, coherentes con una escena real de dia.",
      "Evita gradaciones artificiales, neones, duotonos, filtros cinematograficos agresivos o tintes globales.",
      "Evita dominante amarilla/ocre/sepia y tambien evita dominante cian/magenta.",
      "Si aparece cielo, debe verse azul natural de dia; si aparece piel, debe verse con tono humano realista.",
      "Fondo con gradientes suaves y bloques geometricos limpios; pocos elementos, bien jerarquizados.",
      "Composicion limpia, legible y contemporanea.",
      "Sin texto, sin logos, sin letras, sin marcos, sin marca de agua.",
      "Basa la ilustracion en la siguiente sinopsis:",
      synopsis,
      contextLine,
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
      return NextResponse.json(
        { error: "No image data returned from OpenAI." },
        { status: 502, headers: corsHeaders }
      );
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

    return NextResponse.json(
      {
        ok: true,
        assetId: asset._id,
        url: typeof asset.url === "string" ? asset.url : null,
        filename,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[sanity/generate-cover] Failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate cover", details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
