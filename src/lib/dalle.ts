import { sanityWriteClient as writeClient } from "@/sanity";

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

  return [
    "Create a horizontal story cover image (1536x1024) that is DIRECTLY grounded in the synopsis.",
    "",
    "Goal:",
    "- The image must depict ONE clear main moment from this exact story (not a generic city scene).",
    "- Focus on the key interaction between the main characters in that moment.",
    "- Prioritize narrative fidelity over visual experimentation.",
    "- The composition MUST include visible human characters involved in the scene.",
    "",
    "Strict content rules:",
    "- Use only people, objects, actions, and setting cues that are explicitly supported by the synopsis.",
    "- If the synopsis implies one main character, show at least that character clearly.",
    "- If the synopsis implies interaction/conflict, show at least two characters with readable expressions/body language.",
    "- Include 2-4 representative objects/environment elements from the synopsis context.",
    "- Do not invent random fantasy elements, magical creatures, surreal symbols, or unrelated scenery.",
    "- If details are missing, keep the scene urban/everyday and believable rather than adding arbitrary details.",
    "- The mood/expression of characters must match the emotional tone implied by the synopsis.",
    "- No violence, aggression, or dramatic confrontation unless explicitly stated in the synopsis.",
    "",
    "Composition constraints:",
    "- Keep the scene simple and readable: 1 primary interaction and at most 5 secondary people in the background.",
    "- Avoid visual clutter and overpopulation.",
    "- Keep one clear focal area in the center or center-left.",
    "",
    "Visual direction:",
    "- Minimal, simple editorial illustration with clean shapes and clear silhouettes.",
    "- The image must read clearly as an illustration, not a photograph.",
    "- Human characters must be stylized and illustrated, never hyperrealistic.",
    "- Favor flat-to-soft-shaded editorial drawing over photographic skin, pores, or lens realism.",
    "- Use vivid, lively colors with natural balance; avoid muted or desaturated palettes.",
    "- Match time-of-day from the synopsis, but keep subjects clearly readable (even at night).",
    "- Keep shadows soft-to-medium and lifted enough to preserve facial and clothing detail.",
    "- Use limited texture and low detail density; avoid painterly realism and gritty rendering.",
    "- Keep facial features natural and calm, with simplified illustrated detail.",
    "- Avoid sepia/yellow cast, fantasy glow, heavy filters, and neon/duotone look.",
    "- Keep the overall mood clear, modern, and approachable.",
    "- Clean composition, strong focal point, readable at thumbnail size.",
    "",
    "Hard constraints:",
    "- No text, letters, logos, watermark, border, UI, or book mockup.",
    "- No collage layout. Single coherent scene.",
    "- No fairy-tale aesthetic, no dreamy fantasy ambience, no whimsical children's-book mood.",
    "- Do not generate storefront signs or billboards with readable text.",
    "- STRICTLY avoid anime, manga, chibi, cartoon, Pixar/3D-animated, comic-book, or cel-shaded styles.",
    "- Avoid exaggerated facial expressions and stylized oversized eyes.",
    "- Avoid dark cinematic grading, gloomy storm palettes, horror ambience, moody fantasy look, and hyper-detailed painterly realism.",
    "- STRICTLY avoid photorealism, cinematic live-action stills, DSLR look, film still look, skin pores, ultra-detailed faces, realistic photography, or hyperreal human rendering.",
    "- Do not make people look like real photographed individuals.",
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
  try {
    const synopsis = stripHtml(text).slice(0, 1600);
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

    const asset = await writeClient.assets.upload("image", buffer, {
      filename,
      contentType: "image/png",
    });

    if (!asset?._id) return null;

    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9u7ilulp";
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
    const fileId = asset._id.replace("image-", "").replace("-png", "");
    const url = `https://cdn.sanity.io/images/${projectId}/${dataset}/${fileId}.png`;

    return { url, filename };
  } catch (err) {
    console.error("[cover] Failed to generate/upload with Flux:", err);
    return null;
  }
}
