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
    status: "approved",
    // Cloned voices are F5-TTS clones of user-supplied reference audio.
    // The license of the underlying voice depends on the consent the user
    // captured when uploading the reference. Until ClonedVoice carries
    // explicit consent fields, mark these as Unverified so the gallery
    // badge prompts a manual check before any commercial reuse.
    license: "Unverified",
  }));
  return NextResponse.json({ voices: [...VOICE_CATALOG, ...dynamic] });
}
