import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { findVoice } from "@/lib/voiceCatalog";

type Segment = { voice: string; text: string };

function isValidSegment(s: unknown): s is Segment {
  return !!s && typeof s === "object"
    && typeof (s as Segment).voice === "string"
    && typeof (s as Segment).text === "string"
    && (s as Segment).text.trim().length > 0;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; spec?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, spec } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  // null/empty clears the spec
  if (spec === null || (Array.isArray(spec) && spec.length === 0)) {
    await prisma.journeyStory.update({ where: { id: storyId }, data: { dialogueSpec: null as never } });
    return NextResponse.json({ ok: true, segmentCount: 0 });
  }

  if (!Array.isArray(spec) || !spec.every(isValidSegment))
    return NextResponse.json({ error: "spec must be a JSON array of {voice, text} objects with non-empty text" }, { status: 400 });

  // Validate voices: static via catalog, or 'f5/<id>' via DB
  for (const seg of spec) {
    if (seg.voice.startsWith("f5/")) {
      const cv = await prisma.clonedVoice.findUnique({ where: { id: seg.voice.slice(3) }, select: { id: true } });
      if (!cv) return NextResponse.json({ error: `Cloned voice not found: ${seg.voice}` }, { status: 400 });
    } else if (!findVoice(seg.voice)) {
      return NextResponse.json({ error: `Unknown voiceId: ${seg.voice}` }, { status: 400 });
    }
  }

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { dialogueSpec: spec as never },
  });
  return NextResponse.json({ ok: true, segmentCount: spec.length });
}
