import { createClerkClient, verifyToken } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { createMobileSessionToken } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export async function POST(req: NextRequest) {
  try {
    const clerkSessionToken = getBearerToken(req);
    if (!clerkSessionToken) {
      return NextResponse.json({ error: "Missing Clerk session token." }, { status: 401 });
    }

    const verified = await verifyToken(clerkSessionToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY,
    });

    const userId = typeof verified.sub === "string" ? verified.sub : "";
    if (!userId) {
      return NextResponse.json({ error: "Invalid Clerk session token." }, { status: 401 });
    }

    const [user, savedBooksCount, savedStoriesCount] = await Promise.all([
      clerkClient.users.getUser(userId),
      prisma.libraryBook.count({ where: { userId } }),
      prisma.libraryStory.count({ where: { userId } }),
    ]);

    const publicMetadata = user.publicMetadata ?? {};
    const token = createMobileSessionToken({
      userId,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null,
      plan: typeof publicMetadata.plan === "string" ? publicMetadata.plan : null,
      targetLanguages: isStringArray(publicMetadata.targetLanguages)
        ? publicMetadata.targetLanguages
        : [],
      booksCount: savedBooksCount,
      storiesCount: savedStoriesCount,
    });

    return NextResponse.json({
      token,
      user: {
        id: userId,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null,
      },
    });
  } catch (error) {
    console.error("POST /api/mobile/session failed", error);
    return NextResponse.json(
      { error: "We could not create a mobile session from the Clerk session." },
      { status: 401 }
    );
  }
}
