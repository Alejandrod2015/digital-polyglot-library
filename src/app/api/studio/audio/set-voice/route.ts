import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { findVoice } from "@/lib/voiceCatalog";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; voiceId?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, voiceId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (voiceId) {
    if (voiceId.startsWith("f5/")) {
      const id = voiceId.slice(3);
      const exists = await prisma.clonedVoice.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: `Cloned voice not found: ${id}` }, { status: 400 });
    } else if (!findVoice(voiceId)) {
      return NextResponse.json({ error: `Unknown voiceId: ${voiceId}` }, { status: 400 });
    }
  }

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { voiceId: voiceId || null },
  });
  return NextResponse.json({ ok: true });
}
