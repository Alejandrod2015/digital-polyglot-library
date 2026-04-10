import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  try {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://www.sanity.io" },
      body: JSON.stringify({
        language: story.journey.language,
        region: story.journey.variant,
        topic: story.topic,
        synopsis: story.synopsis || "",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`generate-title failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const newTitle = data.result?.trim();
    if (!newTitle) throw new Error("generate-title returned empty title");

    // Regenerate slug from new title
    const baseSlug = newTitle.toLowerCase()
      .replace(/[áéíóúüñç]/g, (c: string) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", ç: "c" } as Record<string, string>)[c] || c)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = story.slotIndex > 0 ? `${baseSlug}-${story.slotIndex + 1}` : baseSlug;

    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { title: newTitle, slug },
    });

    return NextResponse.json({ ok: true, title: newTitle, slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
