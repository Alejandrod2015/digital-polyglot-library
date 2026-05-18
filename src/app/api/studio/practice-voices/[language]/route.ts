// GET /api/studio/practice-voices/[language]
//
// Lists the TTS voices available for practice exercises in a given
// language. Powers the per-story "Voz de práctica" dropdown in
// PracticeSetEditor. Auth-gated to Studio members; nothing reaches the
// public surface.

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { listPracticeVoices } from "@/lib/practiceVoices";

async function requireStudio(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return false;
  return isStudioMember(email);
}

type Params = { params: Promise<{ language: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await requireStudio())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { language } = await params;
  const voices = listPracticeVoices(language);
  return NextResponse.json({ language, voices });
}
