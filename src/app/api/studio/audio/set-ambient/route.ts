import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

const KNOWN_AMBIENTS = new Set(["mercado", "metro", "restaurante", "bar", "cafeteria", "lluvia"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; ambientTag?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, ambientTag } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (ambientTag && !KNOWN_AMBIENTS.has(ambientTag))
    return NextResponse.json({ error: `Unknown ambient: ${ambientTag}` }, { status: 400 });

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { ambientTag: ambientTag || null },
  });

  return NextResponse.json({ ok: true });
}
