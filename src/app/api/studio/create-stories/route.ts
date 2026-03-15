import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stories = await prisma.userStory.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        slug: true,
        language: true,
        level: true,
        cefrLevel: true,
        topic: true,
        public: true,
        coverUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { stories },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[studio/create-stories] Failed to load Create stories:", error);
    return NextResponse.json(
      { error: "Failed to load Create stories." },
      { status: 500 }
    );
  }
}
