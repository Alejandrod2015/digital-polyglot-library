import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  createStudioCatalogBook,
  listStudioCatalogBooks,
} from "@/lib/studioCatalogBooks";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

function parseBool(v: string | null): boolean | undefined {
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const books = await listStudioCatalogBooks({
    language: url.searchParams.get("language") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    published: parseBool(url.searchParams.get("published")),
    query: url.searchParams.get("q") ?? undefined,
  });
  return NextResponse.json({ books });
}

export async function POST(req: NextRequest) {
  if (!(await requireStudio())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const book = await createStudioCatalogBook(body);
    revalidatePath("/studio/catalog-books");
    return NextResponse.json({ book }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
