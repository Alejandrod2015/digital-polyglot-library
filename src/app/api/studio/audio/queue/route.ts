import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stories = await prisma.journeyStory.findMany({
    where: {
      AND: [
        { text: { not: null } },
        { title: { not: null } },
      ],
    },
    select: {
      id: true,
      title: true,
      level: true,
      topic: true,
      slotIndex: true,
      wordCount: true,
      audioUrl: true,
      audioStatus: true,
      audioFilename: true,
      audioUrlPreview: true,
      audioFilenamePreview: true,
      ambientTag: true,
      voiceId: true,
      dialogueSpec: true,
      updatedAt: true,
      journey: { select: { id: true, name: true, language: true, variant: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({ stories });
}
