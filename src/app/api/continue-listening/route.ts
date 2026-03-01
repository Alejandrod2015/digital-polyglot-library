export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ContinueListeningRow = {
  bookSlug: string;
  storySlug: string;
  lastPlayedAt: string;
  progressSec?: number;
  audioDurationSec?: number;
};

type ContinueListeningBody =
  | {
      bookSlug: string;
      storySlug: string;
      progressSec?: number;
      audioDurationSec?: number;
    }
  | {
      items: Array<{
        bookSlug: string;
        storySlug: string;
        progressSec?: number;
        audioDurationSec?: number;
      }>;
    };

type ContinuePayloadItem = {
  bookSlug: string;
  storySlug: string;
  progressSec?: number;
  audioDurationSec?: number;
};

function isValidPair(x: unknown): x is ContinuePayloadItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.bookSlug === "string" &&
    typeof o.storySlug === "string" &&
    (typeof o.progressSec === "number" || o.progressSec === undefined) &&
    (typeof o.audioDurationSec === "number" || o.audioDurationSec === undefined)
  );
}

function parseBody(x: unknown): ContinuePayloadItem[] | null {
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

function isMissingContinueTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { code?: string; message?: string };
  return (
    maybe.code === "P2021" ||
    (typeof maybe.message === "string" &&
      maybe.message.includes("dp_continue_listening_v1") &&
      maybe.message.includes("does not exist"))
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let rows:
      | Array<{
          bookSlug: string;
          storySlug: string;
          lastPlayedAt: Date;
          progressSec: number | null;
          audioDurationSec: number | null;
        }>
      | Array<{
          bookSlug: string;
          storySlug: string;
          lastPlayedAt: Date;
        }>;

    try {
      rows = await prisma.continueListeningEntry.findMany({
        where: { userId },
        select: {
          bookSlug: true,
          storySlug: true,
          lastPlayedAt: true,
          progressSec: true,
          audioDurationSec: true,
        },
        orderBy: [{ lastPlayedAt: "desc" }, { bookSlug: "asc" }, { storySlug: "asc" }],
        take: 8,
      });
    } catch (err) {
      if (isMissingContinueTableError(err)) {
        const metrics = await prisma.userMetric.findMany({
          where: {
            userId,
            eventType: { in: ["continue_listening", "audio_play"] },
            bookSlug: { not: null },
          },
          select: {
            bookSlug: true,
            storySlug: true,
            createdAt: true,
            metadata: true,
          },
          orderBy: [{ createdAt: "desc" }, { bookSlug: "asc" }, { storySlug: "asc" }],
          take: 200,
        });

        const seen = new Set<string>();
        const items: ContinueListeningRow[] = [];
        for (const metric of metrics) {
          if (!metric.bookSlug) continue;
          const key = `${metric.bookSlug}:${metric.storySlug}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const meta =
            metric.metadata && typeof metric.metadata === "object"
              ? (metric.metadata as Record<string, unknown>)
              : null;

          items.push({
            bookSlug: metric.bookSlug,
            storySlug: metric.storySlug,
            lastPlayedAt: metric.createdAt.toISOString(),
            progressSec:
              meta && typeof meta.progressSec === "number"
                ? Math.round(meta.progressSec)
                : undefined,
            audioDurationSec:
              meta && typeof meta.audioDurationSec === "number"
                ? Math.round(meta.audioDurationSec)
                : undefined,
          });

          if (items.length >= 8) break;
        }

        return NextResponse.json(items);
      }
      // Fallback para clientes Prisma desactualizados.
      rows = await prisma.continueListeningEntry.findMany({
        where: { userId },
        select: {
          bookSlug: true,
          storySlug: true,
          lastPlayedAt: true,
        },
        orderBy: [{ lastPlayedAt: "desc" }, { bookSlug: "asc" }, { storySlug: "asc" }],
        take: 8,
      });
    }

    const items: ContinueListeningRow[] = rows.map((row) => ({
      bookSlug: row.bookSlug,
      storySlug: row.storySlug,
      lastPlayedAt: row.lastPlayedAt.toISOString(),
      progressSec: "progressSec" in row ? row.progressSec ?? undefined : undefined,
      audioDurationSec:
        "audioDurationSec" in row ? row.audioDurationSec ?? undefined : undefined,
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
    try {
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
              progressSec:
                typeof pair.progressSec === "number" && Number.isFinite(pair.progressSec)
                  ? Math.max(0, Math.round(pair.progressSec))
                  : undefined,
              audioDurationSec:
                typeof pair.audioDurationSec === "number" && Number.isFinite(pair.audioDurationSec)
                  ? Math.max(0, Math.round(pair.audioDurationSec))
                  : undefined,
            },
            create: {
              userId,
              bookSlug: pair.bookSlug,
              storySlug: pair.storySlug,
              lastPlayedAt: new Date(nowMs - index),
              progressSec:
                typeof pair.progressSec === "number" && Number.isFinite(pair.progressSec)
                  ? Math.max(0, Math.round(pair.progressSec))
                  : undefined,
              audioDurationSec:
                typeof pair.audioDurationSec === "number" && Number.isFinite(pair.audioDurationSec)
                  ? Math.max(0, Math.round(pair.audioDurationSec))
                  : undefined,
            },
          })
        )
      );
    } catch (err) {
      if (isMissingContinueTableError(err)) {
        await prisma.userMetric.createMany({
          data: limited.map((pair) => ({
            userId,
            bookSlug: pair.bookSlug,
            storySlug: pair.storySlug,
            eventType: "continue_listening",
            metadata: {
              progressSec:
                typeof pair.progressSec === "number" && Number.isFinite(pair.progressSec)
                  ? Math.max(0, Math.round(pair.progressSec))
                  : null,
              audioDurationSec:
                typeof pair.audioDurationSec === "number" && Number.isFinite(pair.audioDurationSec)
                  ? Math.max(0, Math.round(pair.audioDurationSec))
                  : null,
            },
          })),
        });
        return NextResponse.json({ success: true, degraded: true });
      }
      // Fallback para clientes Prisma desactualizados.
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
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error en POST /api/continue-listening:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
