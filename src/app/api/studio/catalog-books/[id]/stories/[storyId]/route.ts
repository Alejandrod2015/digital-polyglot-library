import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  deleteStudioCatalogStory,
  getStudioCatalogStory,
  patchStudioCatalogStory,
} from "@/lib/studioCatalogBooks";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ id: string; storyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, storyId } = await params;
  const story = await getStudioCatalogStory(id, storyId);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ story });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, storyId } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const story = await patchStudioCatalogStory(id, storyId, body);
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    revalidatePath(`/studio/catalog-books/${id}`);
    revalidatePath(`/studio/catalog-books/${id}/stories/${story.id}`);
    return NextResponse.json({ story });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, storyId } = await params;
  const ok = await deleteStudioCatalogStory(id, storyId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath(`/studio/catalog-books/${id}`);
  return NextResponse.json({ ok: true });
}
