import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function openai(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY for OpenAI cover generation.");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Provider catalog. Each entry corresponds to one image-generation backend
// the cover-variants endpoint can dispatch to. Adding a new model usually
// means: add the slug here, implement the buffer generator below, branch
// in the endpoint dispatcher, and surface it in the Studio UI.
export type CoverProvider =
  | "flux"
  | "openai"
  | "gemini-imagen-4"
  | "gemini-imagen-4-ultra"
  | "gemini-flash-image"
  | "gemini-3-pro-image";
export const COVER_PROVIDERS: CoverProvider[] = [
  "flux",
  "openai",
  "gemini-imagen-4",
  "gemini-imagen-4-ultra",
  "gemini-flash-image",
  "gemini-3-pro-image",
];
export const COVER_PROVIDER_LABEL: Record<CoverProvider, string> = {
  "flux": "Flux 2 Pro (BFL)",
  "openai": "OpenAI gpt-image-1",
  "gemini-imagen-4": "Gemini Imagen 4",
  "gemini-imagen-4-ultra": "Gemini Imagen 4 Ultra",
  "gemini-flash-image": "Gemini 2.5 Flash Image",
  "gemini-3-pro-image": "Gemini 3 Pro Image (preview)",
};

export function stripHtmlForCover(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeFileChunk(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Three palette flavors of the same cartoon style. We validated the cartoon
// look (Storyset/Freepik aesthetic, mid-shot characters, vivid-but-not-pastel
// saturation) directly against gemini-3-pro-image-preview before promoting
// the prompt; see scripts/testCoverPrompt.ts for the iteration history.
export type CoverVariant = "cool-cartoon" | "warm-cartoon" | "earthy-cartoon";

export const COVER_VARIANTS: CoverVariant[] = ["cool-cartoon", "warm-cartoon", "earthy-cartoon"];

const SHARED_CARTOON_STYLE = [
  "Modern flat cartoon character illustration in the Storyset / Freepik educational-app aesthetic.",
  "Stylized rounded faces with large expressive almond-shaped eyes,",
  "soft gradient skin shading, simplified cel-shaded clothing, smooth clean linework, friendly approachable expressions.",
  "Same family of illustrations used by Duolingo, Notion, Headspace and Babbel landing pages.",
].join(" ");

// Each palette anchors a different mood but keeps the same intensity tier:
// vivid confident saturation, never pastel, never neon.
const COVER_VARIANT_PALETTE: Record<CoverVariant, string> = {
  "cool-cartoon":
    "Color tonality: cool harmony anchored on sage green, lavender and dusty blue, with vivid confident saturation, not pastel and not washed-out. Use as many colors as the scene needs across props, clothing and environment.",
  "warm-cartoon":
    "Color tonality: warm harmony anchored on peach, terracotta and sage, with vivid confident saturation, not pastel and not washed-out. Use as many colors as the scene needs across props, clothing and environment.",
  "earthy-cartoon":
    "Color tonality: earthy harmony anchored on olive, rust, mustard and cream, with vivid confident saturation, not pastel and not washed-out. Use as many colors as the scene needs across props, clothing and environment.",
};

// Strip proper nouns (character names, brand names) so Imagen-style models
// don't render them as captions on top of the image. We keep a small
// allowlist of city/country names that are useful as scene grounding.
const PROPER_NOUN_KEEP = new Set([
  "I", "A", "An", "The",
  "Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Vienna",
  "Madrid", "Barcelona", "Sevilla", "Valencia",
  "Paris", "Lyon", "Marseille",
  "Rome", "Milan", "Florence", "Venice",
  "London", "Lisbon", "Porto",
  "Mexico", "Buenos", "Aires",
]);

function summarizeSynopsis(synopsis: string): string {
  const firstSentence = synopsis.split(/(?<=[.!?][”’"'»]?)\s+/)[0] ?? synopsis;
  const trimmed = firstSentence.length > 240 ? firstSentence.slice(0, 240) : firstSentence;
  return trimmed
    .replace(/\b[A-Z][a-zA-Z]{2,}\b/g, (token) => (PROPER_NOUN_KEEP.has(token) ? token : ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCoverPrompt(args: {
  title: string;
  synopsis: string;
  language: string;
  region: string;
  topic: string;
  level: string;
  variant?: CoverVariant;
}): string {
  const { synopsis, topic, variant = "cool-cartoon" } = args;
  const scene = summarizeSynopsis(synopsis);
  const topicHint = topic ? topic.replace(/-/g, " ") : "";
  const sceneLine = scene
    ? `Editorial book cover illustration depicting ${scene}`
    : `Editorial book cover illustration of a ${topicHint || "calm everyday scene"}`;
  return [
    sceneLine.endsWith(".") ? sceneLine : `${sceneLine}.`,
    SHARED_CARTOON_STYLE,
    COVER_VARIANT_PALETTE[variant],
    "Depict the main characters from the scene as the focal point in mid-shot framing, faces clearly visible. The characters fill most of the frame; the environment is a clean, simple backdrop.",
    "Wide horizontal 16:9 landscape frame.",
    "No text, no letters, no captions, no logos, no borders.",
  ].join(" ");
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
  return readString(payload, "status") || readNestedString(payload, ["result", "status"]) || null;
}

export async function generateOpenAIImageBase64(prompt: string): Promise<string> {
  const result = (await openai().images.generate({
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

  if (!imageBase64) throw new Error("No image data returned from OpenAI.");
  return imageBase64;
}

export async function generateFluxImageBuffer(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("Missing BFL_API_KEY for Flux cover generation.");

  const endpoints = (() => {
    const envValue = process.env.BFL_FLUX_ENDPOINT?.trim() ?? "";
    if (envValue.length > 0) {
      return envValue.split(",").map((part) => part.trim()).filter(Boolean);
    }
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
      return { prompt, width: 1536, height: 1024, output_format: "png", safety_tolerance: 2 };
    }
    return { prompt, aspect_ratio: "3:2", output_format: "png", raw: false, safety_tolerance: 2 };
  };

  let started: unknown = null;
  let lastStartError = "";
  for (const endpoint of endpoints) {
    try {
      const reqBody = buildRequestBody(endpoint);
      const start = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-key": apiKey },
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
    throw new Error(`Flux start request failed on all endpoints. Last error: ${lastStartError || "unknown"}`);
  }

  const immediateBase64 = extractFluxBase64(started);
  if (immediateBase64) return Buffer.from(immediateBase64, "base64");

  const immediateUrl = extractFluxImageUrl(started);
  if (immediateUrl) {
    const imageRes = await fetch(immediateUrl);
    if (!imageRes.ok) throw new Error(`Failed to download Flux image (${imageRes.status})`);
    return Buffer.from(await imageRes.arrayBuffer());
  }

  const pollUrl =
    readString(started, "polling_url") ||
    readString(started, "result_url") ||
    (() => {
      const id = readString(started, "id");
      if (!id) return null;
      return `https://api.us1.bfl.ai/v1/get_result?id=${encodeURIComponent(id)}`;
    })();

  if (!pollUrl) throw new Error("Flux response did not return image output or polling URL.");

  const maxAttempts = 36;
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const poll = await fetch(pollUrl, { headers: { "x-key": apiKey } });
    if (!poll.ok) continue;
    const polled = (await poll.json()) as unknown;

    const polledBase64 = extractFluxBase64(polled);
    if (polledBase64) return Buffer.from(polledBase64, "base64");

    const polledUrl = extractFluxImageUrl(polled);
    if (polledUrl) {
      const imageRes = await fetch(polledUrl);
      if (!imageRes.ok) throw new Error(`Failed to download Flux image (${imageRes.status})`);
      return Buffer.from(await imageRes.arrayBuffer());
    }

    const status = (extractFluxStatus(polled) ?? "").toLowerCase();
    if (status.includes("moderated") || status.includes("content policy") || status.includes("not found")) {
      throw new Error(`Flux rejected the prompt (status: "${status}"). The cover prompt likely triggered content moderation — try simplifying the synopsis or reducing negative constraint words in the prompt.`);
    }
    if (status.includes("error") || status.includes("fail")) {
      throw new Error("Flux generation failed while polling.");
    }
  }

  throw new Error("Flux generation timed out while polling.");
}

// Google Gemini API — image generation. Two distinct surfaces:
//   - Imagen 4 (`imagen-4.0-generate-001`): pure image model with explicit
//     aspectRatio control. Best when you want predictable layouts.
//   - Gemini 2.5 Flash Image (`gemini-2.5-flash-image-preview`): multimodal
//     model that returns inline image data; aspect ratio biased via prompt.
// Both read GEMINI_API_KEY from the env. Get one at
// https://aistudio.google.com/app/apikey and put it in .env.local.

function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY for Gemini cover generation.");
  return key;
}

export async function generateGeminiImagen4Buffer(prompt: string, modelOverride?: string): Promise<Buffer> {
  const apiKey = geminiApiKey();
  const model = modelOverride ?? process.env.GEMINI_IMAGEN_MODEL ?? "imagen-4.0-generate-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "16:9",
        personGeneration: "allow_adult",
      },
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini Imagen rejected request (${response.status}): ${details.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string; raiFilteredReason?: string }>;
  };
  const prediction = payload.predictions?.[0];
  if (!prediction) throw new Error("Gemini Imagen returned no predictions.");
  if (prediction.raiFilteredReason) {
    throw new Error(`Gemini Imagen filtered: ${prediction.raiFilteredReason}`);
  }
  if (!prediction.bytesBase64Encoded) {
    throw new Error("Gemini Imagen returned no image bytes.");
  }
  return Buffer.from(prediction.bytesBase64Encoded, "base64");
}

export async function generateGeminiFlashImageBuffer(prompt: string, modelOverride?: string): Promise<Buffer> {
  const apiKey = geminiApiKey();
  const model = modelOverride ?? process.env.GEMINI_FLASH_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const orientedPrompt =
    "Generate a horizontal 16:9 landscape cover illustration. " + prompt;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: orientedPrompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini Flash Image rejected request (${response.status}): ${details.slice(0, 300)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini Flash Image blocked: ${payload.promptFeedback.blockReason}`);
  }
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
  }
  throw new Error("Gemini Flash Image returned no inline image data.");
}
