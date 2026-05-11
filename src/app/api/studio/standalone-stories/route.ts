import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  createStudioStandaloneStory,
  listStudioStandaloneStories,
  type ListFilters,
} from "@/lib/studioStandaloneStories";

async function requireStudio(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return null;
  if (!(await isStudioMember(email))) return null;
  return email;
}

function parseBool(value: string | null): boolean | undefined {
  if (value === null || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(req: NextRequest) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const filters: ListFilters = {
    language: url.searchParams.get("language") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    cefrLevel: url.searchParams.get("cefrLevel") ?? undefined,
    sourceType: url.searchParams.get("sourceType") ?? undefined,
    query: url.searchParams.get("q") ?? undefined,
    published: parseBool(url.searchParams.get("published")),
  };
  const stories = await listStudioStandaloneStories(filters);
  return NextResponse.json({ stories });
}

export async function POST(req: NextRequest) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const story = await createStudioStandaloneStory(body);
    revalidatePath("/studio/standalone-stories");
    return NextResponse.json({ story }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
