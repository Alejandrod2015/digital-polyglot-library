import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createStudioJourneyStoryWithSeed,
  getJourneyCoverageGaps,
  listStudioJourneyStories,
} from "@/lib/studioJourneyStories";
import type { JourneyStoryPatch } from "@/lib/studioJourneyStories";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stories = await listStudioJourneyStories();
  const gaps = await getJourneyCoverageGaps(stories);
  return NextResponse.json({ stories, gaps });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as JourneyStoryPatch;
    const story = await createStudioJourneyStoryWithSeed(body);
    revalidatePath("/studio/journey-stories");
    return NextResponse.json({ story }, { status: 201 });
  } catch (error) {
    console.error("[studio/journey-stories] failed to create draft", error);
    return NextResponse.json({ error: "Failed to create story draft" }, { status: 500 });
  }
}
