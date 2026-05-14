import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  deleteStudioCatalogBook,
  getStudioCatalogBook,
  listStudioCatalogStories,
  patchStudioCatalogBook,
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
  const [book, stories] = await Promise.all([
    getStudioCatalogBook(id),
    listStudioCatalogStories(id),
  ]);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ book, stories });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const book = await patchStudioCatalogBook(id, body);
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
    revalidatePath("/studio/catalog-books");
    revalidatePath(`/studio/catalog-books/${id}`);
    return NextResponse.json({ book });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteStudioCatalogBook(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath("/studio/catalog-books");
  return NextResponse.json({ ok: true });
}
