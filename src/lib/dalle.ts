import { uploadPublicObject } from "@/lib/objectStorage";

export type CoverParams = {
  title: string;
  language: string;
  region?: string;
  topic: string;
  level: string;
  text: string;
};

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Keep only the first couple of sentences as the cover seed. Pasting the
// full body verbatim (dialogue, charged supernatural prose) is what trips
// Flux's "request moderated" filter; a short scene summary does not.
function summarizeForCover(input: string): string {
  const clean = input.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(" ").slice(0, 320);
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
  const stop = new Set(["The", "This", "That", "Under", "Safe", "Story", "Laguna"]);
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
    /\b(lagoon|laguna|lake|shore|dock|pier|fisherman|fishing|boat|current|fog|water)\b/.test(
      lower
    );

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

  // DPL covers must read as adult literary novel covers, not children's
  // books or language-app mascots (user memory feedback_cover_style.md +
  // story-quality-spec.md §5). Flux 2 Pro has NO negative_prompt field and
  // diffusion encoders do not parse negation, so a "no sepia / no cartoon"
  // word-wall injects those exact tokens and anchors the model toward them.
  // Steer with POSITIVE anchors only: "realistic adult proportions" holds
  // cartoon-bebé at bay, "bright daylight + high saturation" holds
  // sepia/somber at bay. Never reintroduce a FORBIDDEN/NEVER word-wall.
  return [
    "Create a horizontal editorial illustration (1536x1024) grounded in the scene below.",
    "Depict one clear main moment with the main characters as the focal point, faces and body language readable.",
    "Include 2-4 representative objects or environment cues drawn from the scene.",
    "",
    "STYLE: Clean, modern flat graphic editorial illustration, in the register of high-end magazine and book covers (New Yorker, Penguin). Bold confident shapes and strong silhouettes, crisp clean edges, smooth flat color fills with minimal detail. Adult human proportions; faces are simplified and stylized as refined graphic design, elegant and grown-up, with calm natural eyes and relaxed neutral expressions. Skin is an even flat tone; cheeks are plain with no rosy blush circles, no pink cheek dots. Smooth, clean digital surfaces with a polished contemporary finish. Expressions are warm, relaxed and natural; the characters are absorbed in the scene, looking at each other or at their activity. Keep the air clean and empty: plain background, no floating musical notes, no sound symbols, no sparkles, no emoji-like icons, no decorative doodles. Mood: fresh, bright, contemporary, alive.",
    "",
    "PALETTE: Bright, clear midday daylight with clean white light. Vivid, fully saturated colors balanced between cool and warm; fresh sky blue, leaf green and clean cream-white, with warm amber, coral and terracotta accents. Colors read true, crisp and luminous, like a sunny modern poster; never a single warm or yellowed cast.",
    "",
    "Keep the composition simple and readable at thumbnail size, with one focal area in the center or center-left.",
    "Wide horizontal 16:9 landscape frame. No text, letters, logos, watermark, border, or book mockup. Single coherent scene.",
    "",
    `Story title: ${title || "(untitled story)"}`,
    contextLine,
    characterLine,
    requiredLine,
    forbiddenLine,
    "",
    "Scene to depict:",
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
  return readString(payload, "status") || readNestedString(payload, ["result", "status"]) || null;
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
      return {
        prompt,
        width: 1536,
        height: 1024,
        output_format: "png",
        safety_tolerance: 2,
      };
    }
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
    // Mirrors coverGenerator.ts: BFL returns these statuses when the
    // safety filter rejects a prompt, but the response is otherwise a
    // normal 200 with status="Content Moderated" (or similar). Without
    // this check the loop keeps polling for the full 90s and throws
    // the misleading "timed out" error, hiding the real cause.
    if (status.includes("moderated") || status.includes("content policy") || status.includes("not found")) {
      throw new Error(
        `Flux rejected the prompt (status: "${status}"). Likely content moderation; try simplifying the synopsis or reducing negative constraint words in the prompt.`
      );
    }
  }

  throw new Error("Flux generation timed out while polling.");
}

export async function generateAndUploadCover({
  title,
  language,
  region,
  topic,
  level,
  text,
}: CoverParams): Promise<{ url: string; filename: string } | null> {
  // Errors propagate to the caller (the route handler decides whether
  // to surface the real message vs. fall back gracefully).
  // - catalog-books and standalone-stories want the real error in the
  //   response body so the Studio UI can show Fátima what to fix.
  // - user/generate-story wraps this in its own try/catch and just
  //   logs the failure, so the resulting null/throw is equally fine.
  const synopsis = summarizeForCover(stripHtml(text));
  const prompt = buildCoverPrompt({
    title,
    synopsis,
    language,
    region: region ?? "",
    topic,
    level,
  });

  const fileBase = sanitizeFileChunk(title || "story-cover");
  const filename = `${fileBase || "story-cover"}-flux-${Date.now()}.png`;
  const buffer = await generateFluxImageBuffer(prompt);

  const uploaded = await uploadPublicObject({
    key: `media/generated/images/${filename}`,
    body: buffer,
    contentType: "image/png",
  });

  if (uploaded?.url) {
    return { url: uploaded.url, filename };
  }

  // R2 upload returned no URL: throw so the caller can surface this
  // distinctly from a Flux failure (the message before this rewrite
  // was a generic "Flux/R2" string that hid which one was at fault).
  throw new Error("R2 upload returned no URL after Flux generation succeeded. Check MEDIA_STORAGE_* env vars.");
}
