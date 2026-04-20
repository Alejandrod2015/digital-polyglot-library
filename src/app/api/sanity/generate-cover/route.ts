import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "next-sanity";
import { writeClient } from "@/sanity/lib/client";
import { uploadPublicObject } from "@/lib/objectStorage";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const sanityServerClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp",
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-05",
  useCdn: false,
  token: process.env.SANITY_API_WRITE_TOKEN,
  perspective: "raw",
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
  provider?: "openai" | "flux";
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

function extractCharacterNames(synopsis: string): string[] {
  const matches = synopsis.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  const stop = new Set([
    "The",
    "This",
    "That",
    "Under",
    "Safe",
    "Story",
    "Laguna",
  ]);
  const names: string[] = [];
  for (const raw of matches) {
    const name = raw.trim();
    if (stop.has(name)) continue;
    if (names.includes(name)) continue;
    names.push(name);
    if (names.length >= 4) break;
  }
  return names;
}

function detectSceneHints(synopsis: string): {
  required: string[];
  forbidden: string[];
} {
  const lower = synopsis.toLowerCase();
  const required: string[] = [];
  const forbidden: string[] = [];

  const hasWater =
    /\b(lagoon|laguna|lake|shore|dock|pier|fisherman|fishing|boat|current|fog|water)\b/.test(lower);

  if (hasWater) {
    required.push(
      "A lagoon/lake shoreline environment as the main setting",
      "At least one small dock or pier visible",
      "A drifting or stranded small fishing boat on water",
      "A rope being used or clearly present as a rescue tool"
    );
    forbidden.push(
      "Do not depict downtown streets, storefront-heavy city blocks, or urban commercial avenues",
      "Do not include East Asian street signage unless explicitly stated in the synopsis",
      "Do not make the setting look like Tokyo, Osaka, Seoul, or generic Asian downtown districts"
    );
  }

  if (/\b(rescue|save|pull|haul|stranded)\b/.test(lower)) {
    required.push("Show a rescue action in progress or just completed");
  }

  if (/\b(cloudy|fog|mist)\b/.test(lower)) {
    required.push("Cloudy or fog-prone atmosphere consistent with the synopsis");
  }

  return { required, forbidden };
}

function buildCoverPrompt(args: {
  title: string;
  synopsis: string;
  language: string;
  region: string;
  topic: string;
  level: string;
}): string {
  const { title, synopsis, language, region, topic, level } = args;
  const characterNames = extractCharacterNames(synopsis);
  const sceneHints = detectSceneHints(synopsis);
  const contextLine = [
    language ? `Story language: ${language}.` : "",
    region ? `Region/culture reference: ${region}.` : "",
    level ? `Learner level: ${level}.` : "",
    topic ? `Topic: ${topic}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const characterLine =
    characterNames.length > 0
      ? `Main character names found in synopsis: ${characterNames.join(", ")}.`
      : "";
  const requiredLine =
    sceneHints.required.length > 0
      ? `Scene lock (MUST include all): ${sceneHints.required.join("; ")}.`
      : "";
  const forbiddenLine =
    sceneHints.forbidden.length > 0
      ? `Strict exclusions: ${sceneHints.forbidden.join("; ")}.`
      : "";

  return [
    "Create a horizontal story cover illustration (1536x1024) grounded in the synopsis.",
    "Depict ONE clear main moment from the story, with visible characters and 2-4 representative objects from the scene.",
    "Keep composition simple and readable: one primary focal area, at most 5 secondary people in the background.",
    "",
    "Style: editorial illustration with flat-to-soft shading, clean shapes, clear silhouettes, vivid lively colors, natural balance.",
    "Match the time-of-day from the synopsis; keep subjects readable with soft-to-medium shadows.",
    "Clean composition with a strong focal point, readable at thumbnail size.",
    "",
    "Single coherent scene. No text, letters, logos, watermark, border, UI, or book mockup.",
    "",
    `Story title: ${title || "(untitled story)"}`,
    contextLine,
    characterLine,
    requiredLine,
    forbiddenLine,
    "",
    "Synopsis to follow literally:",
    synopsis,
  ]
    .filter(Boolean)
    .join("\n");
}

function readString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readNestedString(obj: unknown, path: string[]): string | null {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

function extractFluxImageUrl(payload: unknown): string | null {
  return (
    readString(payload, "sample") ||
    readString(payload, "image_url") ||
    readString(payload, "url") ||
    readNestedString(payload, ["result", "sample"]) ||
    readNestedString(payload, ["result", "image_url"]) ||
    readNestedString(payload, ["result", "url"]) ||
    null
  );
}

function extractFluxBase64(payload: unknown): string | null {
  return (
    readString(payload, "b64_json") ||
    readString(payload, "image_base64") ||
    readNestedString(payload, ["result", "b64_json"]) ||
    readNestedString(payload, ["result", "image_base64"]) ||
    null
  );
}

function extractFluxStatus(payload: unknown): string | null {
  return (
    readString(payload, "status") ||
    readNestedString(payload, ["result", "status"]) ||
    null
  );
}

function getDraftId(documentId: string): string {
  return documentId.startsWith("drafts.") ? documentId : `drafts.${documentId}`;
}

function getPublishedId(documentId: string): string {
  return documentId.startsWith("drafts.") ? documentId.replace(/^drafts\./, "") : documentId;
}

type SanityDoc = {
  _id: string;
  _type: string;
  [key: string]: unknown;
};

async function generateOpenAIImageBase64(prompt: string): Promise<string> {
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
    throw new Error("No image data returned from OpenAI.");
  }
  return imageBase64;
}

async function generateFluxImageBuffer(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing BFL_API_KEY for Flux cover generation.");
  }

  const endpoints = (() => {
    const envValue = process.env.BFL_FLUX_ENDPOINT?.trim() ?? "";
    if (envValue.length > 0) {
      return envValue
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
    // Default fallback chain prioritized for stronger prompt adherence.
    return [
      "https://api.bfl.ai/v1/flux-2-pro-preview",
      "https://api.us.bfl.ai/v1/flux-2-pro-preview",
      "https://api.bfl.ai/v1/flux-2-pro",
      "https://api.bfl.ai/v1/flux-pro-1.1-ultra",
    ];
  })();

  const buildRequestBody = (endpoint: string) => {
    const lower = endpoint.toLowerCase();
    if (lower.includes("flux-2-")) {
      // FLUX.2 endpoints: prioritize prompt fidelity.
      return {
        prompt,
        width: 1536,
        height: 1024,
        output_format: "png",
        safety_tolerance: 2,
      };
    }
    // FLUX 1.1 Ultra fallback (legacy in this chain).
    return {
      prompt,
      aspect_ratio: "3:2",
      output_format: "png",
      raw: false,
      safety_tolerance: 2,
    };
  };

  let started: unknown = null;
  let lastStartError = "";
  for (const endpoint of endpoints) {
    try {
      const reqBody = buildRequestBody(endpoint);
      console.info("[flux] requesting cover", {
        endpoint,
        bodyKeys: Object.keys(reqBody),
      });
      const start = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-key": apiKey,
        },
        body: JSON.stringify(reqBody),
      });

      if (!start.ok) {
        const details = await start.text();
        lastStartError = `${endpoint} -> ${start.status}: ${details.slice(0, 300)}`;
        continue;
      }

      started = (await start.json()) as unknown;
      lastStartError = "";
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastStartError = `${endpoint} -> ${message}`;
    }
  }

  if (!started) {
    throw new Error(
      `Flux start request failed on all endpoints. Last error: ${lastStartError || "unknown"}`
    );
  }
  const immediateBase64 = extractFluxBase64(started);
  if (immediateBase64) return Buffer.from(immediateBase64, "base64");

  const immediateUrl = extractFluxImageUrl(started);
  if (immediateUrl) {
    const imageRes = await fetch(immediateUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download Flux image (${imageRes.status})`);
    }
    const arr = await imageRes.arrayBuffer();
    return Buffer.from(arr);
  }

  const pollUrl =
    readString(started, "polling_url") ||
    readString(started, "result_url") ||
    (() => {
      const id = readString(started, "id");
      if (!id) return null;
      return `https://api.us1.bfl.ai/v1/get_result?id=${encodeURIComponent(id)}`;
    })();

  if (!pollUrl) {
    throw new Error("Flux response did not return image output or polling URL.");
  }

  const maxAttempts = 36;
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const poll = await fetch(pollUrl, {
      headers: { "x-key": apiKey },
    });
    if (!poll.ok) continue;
    const polled = (await poll.json()) as unknown;

    const polledBase64 = extractFluxBase64(polled);
    if (polledBase64) return Buffer.from(polledBase64, "base64");

    const polledUrl = extractFluxImageUrl(polled);
    if (polledUrl) {
      const imageRes = await fetch(polledUrl);
      if (!imageRes.ok) {
        throw new Error(`Failed to download Flux image (${imageRes.status})`);
      }
      const arr = await imageRes.arrayBuffer();
      return Buffer.from(arr);
    }

    const status = (extractFluxStatus(polled) ?? "").toLowerCase();
    if (status.includes("error") || status.includes("fail")) {
      throw new Error("Flux generation failed while polling.");
    }
  }

  throw new Error("Flux generation timed out while polling.");
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
    const providerRaw = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "openai";
    const provider = providerRaw === "flux" ? "flux" : "openai";

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
    const prompt = buildCoverPrompt({
      title,
      synopsis,
      language,
      region,
      topic,
      level,
    });

    const fileBase = sanitizeFileChunk(title || "story-cover");
    const filename = `${fileBase || "story-cover"}-${provider}-${Date.now()}.png`;
    const buffer =
      provider === "flux"
        ? await generateFluxImageBuffer(prompt)
        : Buffer.from(await generateOpenAIImageBase64(prompt), "base64");

    const uploaded = await uploadPublicObject({
      key: `media/generated/images/${filename}`,
      body: buffer,
      contentType: "image/png",
    });

    let coverField: Record<string, unknown> | undefined;
    if (!uploaded?.url) {
      const asset = await writeClient.assets.upload("image", buffer, {
        filename,
        contentType: "image/png",
      });
      coverField = {
        _type: "image",
        asset: {
          _type: "reference",
          _ref: asset._id,
        },
      };
    }

    const publishedId = getPublishedId(documentId);
    const draftId = getDraftId(documentId);
    const [publishedDoc, draftDoc] = await Promise.all([
      sanityServerClient.fetch<SanityDoc | null>(`*[_id == $id][0]`, { id: publishedId }),
      sanityServerClient.fetch<SanityDoc | null>(`*[_id == $id][0]`, { id: draftId }),
    ]);

    const docType = draftDoc?._type ?? publishedDoc?._type;
    if (!docType) {
      return NextResponse.json(
        { error: "Could not resolve the document type for this cover generation." },
        { status: 404, headers: corsHeaders }
      );
    }

    const nextDraft: SanityDoc = {
      ...(publishedDoc ?? {}),
      ...(draftDoc ?? {}),
      _id: draftId,
      _type: docType,
      ...(coverField ? { cover: coverField } : {}),
      ...(uploaded?.url ? { coverUrl: uploaded.url } : {}),
    };

    const tx = writeClient.transaction().createOrReplace(nextDraft);
    if (uploaded?.url && !coverField) {
      tx.patch(draftId, (patch) => patch.unset(["cover"]));
    }
    await tx.commit({ autoGenerateArrayKeys: true });

    return NextResponse.json(
      {
        ok: true,
        provider,
        assetId: coverField && typeof coverField.asset === "object"
          ? ((coverField.asset as { _ref?: string })._ref ?? null)
          : null,
        url: uploaded?.url ?? null,
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
