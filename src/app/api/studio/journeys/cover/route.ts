import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import OpenAI from "openai";

export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeFileChunk(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function extractCharacterNames(synopsis: string): string[] {
  const matches = synopsis.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? [];
  const stop = new Set(["The", "This", "That", "Under", "Safe", "Story", "Laguna"]);
  const names: string[] = [];
  for (const raw of matches) {
    const name = raw.trim();
    if (stop.has(name) || names.includes(name)) continue;
    names.push(name);
    if (names.length >= 4) break;
  }
  return names;
}

function buildCoverPrompt(args: { title: string; synopsis: string; language: string; region: string; topic: string; level: string }): string {
  const { title, synopsis, language, region, topic, level } = args;
  const characterNames = extractCharacterNames(synopsis);
  const contextLine = [
    language ? `Story language: ${language}.` : "",
    region ? `Region/culture reference: ${region}.` : "",
    level ? `Learner level: ${level}.` : "",
    topic ? `Topic: ${topic}.` : "",
  ].filter(Boolean).join(" ");
  const characterLine = characterNames.length > 0 ? `Main character names: ${characterNames.join(", ")}.` : "";

  return [
    "Create a horizontal story cover image (1536x1024) that is DIRECTLY grounded in the synopsis.",
    "",
    "Goal: depict ONE clear main moment from the story. Focus on the key interaction between characters.",
    "",
    "Visual direction: Minimal editorial illustration, clean shapes, vivid colors, readable at thumbnail size.",
    "Human characters must be stylized and illustrated, never hyperrealistic.",
    "",
    "Hard constraints: No text, logos, watermark, border. No collage. No anime/manga/3D/cartoon.",
    "No photorealism. No fantasy glow. Single coherent scene.",
    "",
    `Story title: ${title || "(untitled story)"}`,
    contextLine,
    characterLine,
    "",
    "Synopsis to follow literally:",
    synopsis,
  ].filter(Boolean).join("\n");
}

async function generateOpenAIImageBase64(prompt: string): Promise<string> {
  const result = (await openai.images.generate({ model: "gpt-image-1", prompt, size: "1536x1024" })) as unknown;
  const imageBase64 = typeof result === "object" && result !== null && Array.isArray((result as any).data) && typeof (result as any).data[0]?.b64_json === "string"
    ? (result as any).data[0].b64_json as string : null;
  if (!imageBase64) throw new Error("No image data returned from OpenAI.");
  return imageBase64;
}

async function generateFluxImageBuffer(prompt: string): Promise<Buffer> {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) throw new Error("Missing BFL_API_KEY for Flux cover generation.");

  const endpoints = (process.env.BFL_FLUX_ENDPOINT?.trim() ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!endpoints.length) endpoints.push("https://api.bfl.ai/v1/flux-2-pro-preview", "https://api.bfl.ai/v1/flux-pro-1.1-ultra");

  let started: any = null;
  for (const endpoint of endpoints) {
    try {
      const isFlux2 = endpoint.toLowerCase().includes("flux-2-");
      const reqBody = isFlux2
        ? { prompt, width: 1536, height: 1024, output_format: "png", safety_tolerance: 2 }
        : { prompt, aspect_ratio: "3:2", output_format: "png", raw: false, safety_tolerance: 2 };
      const start = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-key": apiKey }, body: JSON.stringify(reqBody) });
      if (!start.ok) continue;
      started = await start.json();
      break;
    } catch { /* try next */ }
  }
  if (!started) throw new Error("Flux start request failed on all endpoints.");

  // Check for immediate result
  if (started.b64_json) return Buffer.from(started.b64_json, "base64");
  if (started.sample || started.image_url || started.url) {
    const url = started.sample || started.image_url || started.url;
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }

  // Poll
  const pollUrl = started.polling_url || started.result_url || (started.id ? `https://api.us1.bfl.ai/v1/get_result?id=${started.id}` : null);
  if (!pollUrl) throw new Error("No polling URL from Flux.");

  for (let i = 0; i < 36; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const poll = await fetch(pollUrl, { headers: { "x-key": apiKey } });
    if (!poll.ok) continue;
    const polled = await poll.json();
    if (polled.b64_json) return Buffer.from(polled.b64_json, "base64");
    const url = polled.sample || polled.image_url || polled.url || polled.result?.sample || polled.result?.image_url;
    if (url) { const res = await fetch(url); if (res.ok) return Buffer.from(await res.arrayBuffer()); }
    const status = (polled.status || "").toLowerCase();
    if (status.includes("error") || status.includes("fail")) throw new Error("Flux generation failed.");
  }
  throw new Error("Flux generation timed out.");
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; provider?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, include: { journey: true } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const synopsis = stripHtml(story.synopsis || story.text || "").slice(0, 1600);
  if (!synopsis) return NextResponse.json({ error: "Story needs text or synopsis before generating cover" }, { status: 400 });

  try {
    const provider = body.provider === "openai" ? "openai" : "flux";
    const prompt = buildCoverPrompt({
      title: story.title || "",
      synopsis,
      language: story.journey.language,
      region: story.journey.variant,
      topic: story.topic,
      level: story.level,
    });

    const fileBase = sanitizeFileChunk(story.title || "story-cover");
    const filename = `${fileBase || "story-cover"}-${provider}-${Date.now()}.png`;
    const buffer = provider === "flux"
      ? await generateFluxImageBuffer(prompt)
      : Buffer.from(await generateOpenAIImageBase64(prompt), "base64");

    const uploaded = await uploadPublicObject({
      key: `media/generated/images/${filename}`,
      body: buffer,
      contentType: "image/png",
    });

    if (!uploaded?.url) throw new Error("Failed to upload cover image");

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { coverUrl: uploaded.url, coverDone: true },
    });

    return NextResponse.json({ ok: true, url: uploaded.url, provider, filename });
  } catch (error) {
    console.error("[journeys/cover] Failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to generate cover", details: message }, { status: 500 });
  }
}
