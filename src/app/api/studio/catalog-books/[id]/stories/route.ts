import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  createStudioCatalogStory,
  listStudioCatalogStories,
} from "@/lib/studioCatalogBooks";

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
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const stories = await listStudioCatalogStories(id);
  return NextResponse.json({ stories });
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const story = await createStudioCatalogStory(id, body);
    revalidatePath(`/studio/catalog-books/${id}`);
    return NextResponse.json({ story }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
