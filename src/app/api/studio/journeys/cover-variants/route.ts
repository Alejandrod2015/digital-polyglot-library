/**
 * Generate 3 cover variants in parallel for a single story so the user can
 * compare flat-poster / layered-paper / muted-watercolor side by side and
 * pick the one that fits.
 *
 * Each variant uses the same synopsis + scene hints but a different style
 * profile (see COVER_VARIANTS in src/lib/coverGenerator). Three Flux Pro
 * calls = ~3x the cost of a single cover; explicit user action required.
 *
 * Returns array of { variant, url, filename }. The user picks one in
 * /studio/covers and the existing /api/studio/journeys/cover endpoint
 * (or a follow-up call here) updates `coverUrl` in DB.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import {
  buildCoverPrompt,
  COVER_VARIANTS,
  generateFluxImageBuffer,
  generateOpenAIImageBase64,
  sanitizeFileChunk,
  stripHtmlForCover,
  type CoverVariant,
} from "@/lib/coverGenerator";

export const maxDuration = 180;

type Body = {
  storyId?: string;
  provider?: string;
  selectVariantUrl?: string; // when set, just persist this URL as the chosen cover
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  // Mode 1: persist a previously-generated variant URL as the chosen cover.
  if (body.selectVariantUrl) {
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { coverUrl: body.selectVariantUrl, coverDone: true },
    });
    return NextResponse.json({ ok: true, coverUrl: body.selectVariantUrl });
  }

  // Mode 2: generate the three variants.
  const synopsis = stripHtmlForCover(story.synopsis || story.text || "").slice(0, 1600);
  if (!synopsis) {
    return NextResponse.json({ error: "Story needs text or synopsis before generating cover" }, { status: 400 });
  }

  const provider = body.provider === "openai" ? "openai" : "flux";
  const fileBase = sanitizeFileChunk(story.title || "story-cover");

  const tasks = COVER_VARIANTS.map(async (variant: CoverVariant) => {
    try {
      const prompt = buildCoverPrompt({
        title: story.title || "",
        synopsis,
        language: story.journey.language,
        region: story.journey.variant,
        topic: story.topic,
        level: story.level,
        variant,
      });
      const filename = `${fileBase || "story-cover"}-${variant}-${provider}-${Date.now()}.png`;
      const buffer = provider === "flux"
        ? await generateFluxImageBuffer(prompt)
        : Buffer.from(await generateOpenAIImageBase64(prompt), "base64");
      const uploaded = await uploadPublicObject({
        key: `media/generated/images/${filename}`,
        body: buffer,
        contentType: "image/png",
      });
      if (!uploaded?.url) throw new Error("upload failed");
      return { variant, url: uploaded.url, filename, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cover-variants] ${variant} failed:`, message);
      return { variant, url: null, filename: null, error: message };
    }
  });

  const results = await Promise.all(tasks);
  const ok = results.filter((r) => r.url !== null);
  const failed = results.filter((r) => r.url === null);
  return NextResponse.json({
    storyId,
    provider,
    variants: results,
    okCount: ok.length,
    failedCount: failed.length,
  });
}
