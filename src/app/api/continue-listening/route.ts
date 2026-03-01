export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ContinueListeningRow = {
  bookSlug: string;
  storySlug: string;
  lastPlayedAt: string;
};

type ContinueListeningBody =
  | { bookSlug: string; storySlug: string }
  | { items: Array<{ bookSlug: string; storySlug: string }> };

function isValidPair(x: unknown): x is { bookSlug: string; storySlug: string } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.bookSlug === "string" && typeof o.storySlug === "string";
}

function parseBody(x: unknown): Array<{ bookSlug: string; storySlug: string }> | null {
  if (!x || typeof x !== "object") return null;
  const body = x as ContinueListeningBody;

  if ("items" in body) {
    if (!Array.isArray(body.items)) return null;
    const clean = body.items.filter(isValidPair);
    return clean.length > 0 ? clean : null;
  }

  if (isValidPair(body)) return [body];
  return null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await prisma.continueListeningEntry.findMany({
      where: { userId },
      select: {
        bookSlug: true,
        storySlug: true,
        lastPlayedAt: true,
      },
      orderBy: { lastPlayedAt: "desc" },
      take: 8,
    });

    const items: ContinueListeningRow[] = rows.map((row) => ({
      bookSlug: row.bookSlug,
      storySlug: row.storySlug,
      lastPlayedAt: row.lastPlayedAt.toISOString(),
    }));

    return NextResponse.json(items);
  } catch (err) {
    console.error("Error en GET /api/continue-listening:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json: unknown = await req.json();
    const pairs = parseBody(json);
    if (!pairs) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const limited = pairs.slice(0, 20);
    const nowMs = Date.now();
    await prisma.$transaction(
      limited.map((pair, index) =>
        prisma.continueListeningEntry.upsert({
          where: {
            userId_bookSlug_storySlug: {
              userId,
              bookSlug: pair.bookSlug,
              storySlug: pair.storySlug,
            },
          },
          update: {
            lastPlayedAt: new Date(nowMs - index),
          },
          create: {
            userId,
            bookSlug: pair.bookSlug,
            storySlug: pair.storySlug,
            lastPlayedAt: new Date(nowMs - index),
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error en POST /api/continue-listening:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
