import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  deleteStudioJourneyStory,
  duplicateStudioJourneyStory,
  getStudioJourneyStory,
  patchStudioJourneyStory,
  type JourneyStoryPatch,
} from "@/lib/studioJourneyStories";

type RouteContext = {
  params: Promise<{ storyId: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId } = await context.params;
  const story = await getStudioJourneyStory(storyId);
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ story });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId } = await context.params;
  try {
    const body = (await req.json()) as JourneyStoryPatch;
    const story = await patchStudioJourneyStory(storyId, body);
    revalidatePath("/studio/journey-stories");
    revalidatePath(`/studio/journey-stories/${storyId}`);
    return NextResponse.json({ story });
  } catch (error) {
    console.error("[studio/journey-stories/:storyId] failed to save", error);
    return NextResponse.json({ error: "Failed to save story" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");
  const { storyId } = await context.params;

  if (action !== "duplicate") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  try {
    const story = await duplicateStudioJourneyStory(storyId);
    revalidatePath("/studio/journey-stories");
    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    console.error("[studio/journey-stories/:storyId] failed to duplicate", error);
    return NextResponse.json({ error: "Failed to duplicate story" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyId } = await context.params;

  try {
    await deleteStudioJourneyStory(storyId);
    revalidatePath("/studio/journey-stories");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[studio/journey-stories/:storyId] failed to delete", error);
    return NextResponse.json({ error: "Failed to delete story" }, { status: 500 });
  }
}
