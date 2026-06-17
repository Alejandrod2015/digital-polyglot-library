import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isStudioMember } from "@/lib/studio-access";

const KNOWN_AMBIENTS = ["mercado", "metro", "restaurante", "bar", "cafeteria", "lluvia"];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const dir = join(process.cwd(), "scripts", "tts", "ambience");
  const ambients = KNOWN_AMBIENTS.filter((tag) => existsSync(join(dir, `${tag}.mp3`)));
  return NextResponse.json({ ambients });
}
