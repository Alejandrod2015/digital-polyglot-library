import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { loadDirective, saveDirective, sanitizeDirective } from "@/agents/config/directive";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const directive = await loadDirective();
  return NextResponse.json({ directive });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const directive = sanitizeDirective({
      ...body,
      updatedBy: email,
      updatedAt: new Date().toISOString(),
    });

    await saveDirective(directive);
    return NextResponse.json({ directive });
  } catch (error) {
    console.error("[api/agents/directive] save failed", error);
    return NextResponse.json({ error: "Failed to save directive" }, { status: 500 });
  }
}
