import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.clonedVoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block deletion if any story references it
  const usage = await prisma.journeyStory.count({ where: { voiceId: `f5/${id}` } });
  if (usage > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${usage} story(ies) use this voice. Reassign them first.` },
      { status: 409 }
    );
  }

  await prisma.clonedVoice.delete({ where: { id } });
  await unlink(existing.refAudioPath).catch(() => {});
  return NextResponse.json({ ok: true });
}
