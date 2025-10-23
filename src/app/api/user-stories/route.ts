import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const stories = await prisma.userStory.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        language: true,
        level: true,
        text: true,
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
