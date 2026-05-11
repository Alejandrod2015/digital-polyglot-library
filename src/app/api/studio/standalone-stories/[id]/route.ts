import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  deleteStudioStandaloneStory,
  getStudioStandaloneStory,
  patchStudioStandaloneStory,
} from "@/lib/studioStandaloneStories";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const story = await getStudioStandaloneStory(id);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ story });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const story = await patchStudioStandaloneStory(id, body);
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    revalidatePath("/studio/standalone-stories");
    revalidatePath(`/studio/standalone-stories/${id}`);
    return NextResponse.json({ story });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await deleteStudioStandaloneStory(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath("/studio/standalone-stories");
  return NextResponse.json({ ok: true });
}
