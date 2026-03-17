export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONTINUE_COMPLETION_RATIO = 0.95;
const CONTINUE_TABLE_CACHE_TTL_MS = 5 * 60 * 1000;
const CONTINUE_PROGRESS_WRITE_THRESHOLD_SEC = 15;

let continueTableCache:
  | {
      checkedAt: number;
      value: boolean;
    }
  | null = null;

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

type ContinueListeningEntrySnapshot = {
  userId: string;
  bookSlug: string;
  storySlug: string;
  progressSec: number | null;
  audioDurationSec: number | null;
  lastPlayedAt: Date;
};

function isCompletedFromAudio(progressSec?: number, audioDurationSec?: number): boolean {
  if (
    typeof progressSec !== "number" ||
    !Number.isFinite(progressSec) ||
    typeof audioDurationSec !== "number" ||
    !Number.isFinite(audioDurationSec) ||
    audioDurationSec <= 0
  ) {
    return false;
  }
  return progressSec >= audioDurationSec * CONTINUE_COMPLETION_RATIO;
}

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

async function hasContinueListeningTable(): Promise<boolean> {
  const now = Date.now();
  if (continueTableCache && now - continueTableCache.checkedAt < CONTINUE_TABLE_CACHE_TTL_MS) {
    return continueTableCache.value;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ regclass: string | null }>>`
      SELECT to_regclass('public.dp_continue_listening_v1')::text AS regclass
    `;
    const value =
      Array.isArray(rows) && rows.length > 0 && typeof rows[0]?.regclass === "string";
    continueTableCache = { checkedAt: now, value };
    return value;
  } catch {
    continueTableCache = { checkedAt: now, value: true };
    return true;
  }
}

function normalizeProgressValue(value?: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function normalizeContinuePayloadItem(pair: ContinuePayloadItem): ContinuePayloadItem {
  return {
    bookSlug: pair.bookSlug,
    storySlug: pair.storySlug,
    progressSec: normalizeProgressValue(pair.progressSec),
    audioDurationSec: normalizeProgressValue(pair.audioDurationSec),
  };
}

function shouldSkipContinueWrite(
  existing: ContinueListeningEntrySnapshot | undefined,
  next: ContinuePayloadItem,
  nowMs: number
): boolean {
  if (!existing) return false;

  const nextProgress = normalizeProgressValue(next.progressSec) ?? 0;
  const existingProgress = normalizeProgressValue(existing.progressSec ?? undefined) ?? 0;
  const nextDuration = normalizeProgressValue(next.audioDurationSec);
  const existingDuration = normalizeProgressValue(existing.audioDurationSec ?? undefined);
  const progressDelta = Math.abs(nextProgress - existingProgress);
  const recentWrite = nowMs - existing.lastPlayedAt.getTime() < CONTINUE_TABLE_CACHE_TTL_MS / 2;

  return (
    progressDelta < CONTINUE_PROGRESS_WRITE_THRESHOLD_SEC &&
    nextDuration === existingDuration &&
    recentWrite
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const hasTable = await hasContinueListeningTable();
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

    if (!hasTable) {
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
            meta && typeof meta.progressSec === "number" ? Math.round(meta.progressSec) : undefined,
          audioDurationSec:
            meta && typeof meta.audioDurationSec === "number"
              ? Math.round(meta.audioDurationSec)
              : undefined,
        });

        if (items.length >= 8) break;
      }

      return NextResponse.json(
        items.filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec))
      );
    }

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
        return NextResponse.json([]);
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

    const items: ContinueListeningRow[] = rows
      .map((row) => ({
        bookSlug: row.bookSlug,
        storySlug: row.storySlug,
        lastPlayedAt: row.lastPlayedAt.toISOString(),
        progressSec: "progressSec" in row ? row.progressSec ?? undefined : undefined,
        audioDurationSec:
          "audioDurationSec" in row ? row.audioDurationSec ?? undefined : undefined,
      }))
      .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec));

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
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      // Algunos clientes/beacons pueden enviar POST vacío al cerrar/cambiar pestaña.
      return NextResponse.json({ success: true, ignored: true });
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const pairs = parseBody(json);
    if (!pairs) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const limited = pairs.slice(0, 20).map(normalizeContinuePayloadItem);
    const completed = limited.filter((pair) =>
      isCompletedFromAudio(pair.progressSec, pair.audioDurationSec)
    );
    const active = limited.filter(
      (pair) => !isCompletedFromAudio(pair.progressSec, pair.audioDurationSec)
    );
    const hasTable = await hasContinueListeningTable();
    const nowMs = Date.now();

    if (!hasTable) {
      await prisma.userMetric.createMany({
        data: active.map((pair) => ({
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

    try {
      const existingRows = limited.length
        ? await prisma.continueListeningEntry.findMany({
            where: {
              userId,
              OR: limited.map((pair) => ({
                bookSlug: pair.bookSlug,
                storySlug: pair.storySlug,
              })),
            },
            select: {
              userId: true,
              bookSlug: true,
              storySlug: true,
              progressSec: true,
              audioDurationSec: true,
              lastPlayedAt: true,
            },
          })
        : [];
      const existingByKey = new Map(
        existingRows.map((row) => [`${row.bookSlug}:${row.storySlug}`, row] as const)
      );
      const activeToWrite = active.filter(
        (pair) =>
          !shouldSkipContinueWrite(
            existingByKey.get(`${pair.bookSlug}:${pair.storySlug}`),
            pair,
            nowMs
          )
      );
      const completedToWrite = completed.filter((pair) =>
        existingByKey.has(`${pair.bookSlug}:${pair.storySlug}`)
      );

      const operations = [
        ...completedToWrite.map((pair) =>
          prisma.continueListeningEntry.deleteMany({
            where: {
              userId,
              bookSlug: pair.bookSlug,
              storySlug: pair.storySlug,
            },
          })
        ),
        ...activeToWrite.map((pair, index) =>
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
              progressSec: pair.progressSec,
              audioDurationSec: pair.audioDurationSec,
            },
          })
        ),
      ];
      if (operations.length > 0) {
        await prisma.$transaction(operations);
      }
    } catch (err) {
      if (isMissingContinueTableError(err)) {
        await prisma.userMetric.createMany({
          data: active.map((pair) => ({
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
