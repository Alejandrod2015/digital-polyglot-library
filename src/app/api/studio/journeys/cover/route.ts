import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import {
  buildCoverPrompt,
  generateFluxImageBuffer,
  generateOpenAIImageBase64,
  sanitizeFileChunk,
  stripHtmlForCover,
} from "@/lib/coverGenerator";

export const maxDuration = 120;

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

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const synopsis = stripHtmlForCover(story.synopsis || story.text || "").slice(0, 1600);
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
