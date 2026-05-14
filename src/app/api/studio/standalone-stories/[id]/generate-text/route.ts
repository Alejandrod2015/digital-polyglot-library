// POST /api/studio/standalone-stories/[id]/generate-text
//
// Manual generation entrypoint used by the StandaloneStory editor in
// Studio Next.js. Generates the title + body + vocab for a single story
// using the pure pipeline-agnostic helper and writes the result back to
// `StandaloneStory` only. Does NOT touch JourneyStory, StoryDraft, or any
// /api/studio/journeys|pipeline|agents/* endpoint.
//
// Strict boundaries (see also vercel.json cron `catalog-health`):
//   - imports prisma → writes ONLY to prisma.standaloneStory
//   - imports generateStoryPayload (pure, no DB writes)
//   - the agentic journey pipeline is fully untouched

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateStoryPayload } from "@/lib/storyGenerator";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.standaloneStory.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const payload = await generateStoryPayload({
    language: story.language ?? "spanish",
    variant: story.variant ?? undefined,
    region: story.region ?? undefined,
    cefrLevel: story.cefrLevel ?? undefined,
    level: story.level ?? undefined,
    focus: story.focus ?? undefined,
    topic: story.topic ?? story.journeyTopic ?? undefined,
    title: story.title || undefined,
    synopsis: story.synopsis ?? undefined,
  });

  if (!payload) {
    return NextResponse.json(
      { error: "Generation failed after 3 attempts. Adjust metadata and retry." },
      { status: 502 }
    );
  }

  const updated = await prisma.standaloneStory.update({
    where: { id },
    data: {
      title: payload.title || story.title,
      text: payload.text,
      vocabRaw: JSON.stringify(payload.vocab, null, 2),
    },
  });

  revalidatePath(`/studio/standalone-stories/${id}`);
  revalidatePath("/studio/standalone-stories");

  return NextResponse.json({
    story: {
      id: updated.id,
      title: updated.title,
      text: updated.text,
      vocabRaw: updated.vocabRaw,
    },
    arcType: payload.arcType,
  });
}
