import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { VOICE_CATALOG, type VoiceEntry } from "@/lib/voiceCatalog";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cloned = await prisma.clonedVoice.findMany({ orderBy: { createdAt: "desc" } });
  const dynamic: VoiceEntry[] = cloned.map((c) => ({
    id: `f5/${c.id}`,
    engine: "f5",
    language: c.language,
    region: c.region ?? undefined,
    gender: c.gender === "m" ? "m" : "f",
    label: `${c.name} (clonada${c.region ? `, ${c.region}` : ""})`,
  }));
  return NextResponse.json({ voices: [...VOICE_CATALOG, ...dynamic] });
}
