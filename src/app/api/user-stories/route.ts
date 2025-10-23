import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get("id");

    // Si viene un id → devolver solo esa historia
    if (storyId) {
      const story = await prisma.userStory.findUnique({
        where: { id: storyId },
        select: {
          id: true,
          title: true,
          slug: true,
          text: true,
          language: true,
          region: true,
          level: true,
          focus: true,
          topic: true,
          audioUrl: true,
          audioFilename: true,
          createdAt: true,
        },
      });

      if (!story) {
        return NextResponse.json({ error: "Story not found" }, { status: 404 });
      }

      return NextResponse.json({ story });
    }

    // Si no hay id → devolver lista general
    const stories = await prisma.userStory.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        text: true,            // ✅ ahora también se envía el texto
        language: true,
        level: true,
        region: true,
        audioUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return NextResponse.json(
      { error: "Failed to load stories" },
      { status: 500 }
    );
  }
}
