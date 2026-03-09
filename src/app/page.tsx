// /src/app/page.tsx (server)
import HomeClient from "./HomeClient";
import { getLatestHomeReleases } from "@/lib/homeReleases";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const CONTINUE_COMPLETION_RATIO = 0.95;

function isCompletedFromAudio(progressSec?: number | null, audioDurationSec?: number | null): boolean {
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

async function hasContinueListeningTable(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ regclass: string | null }>>`
      SELECT to_regclass('public.dp_continue_listening_v1')::text AS regclass
    `;
    return Array.isArray(rows) && rows.length > 0 && typeof rows[0]?.regclass === "string";
  } catch {
    return true;
  }
}

export default async function HomePage() {
  const { userId } = await auth();
  const isMissingContinueTableError = (err: unknown): boolean => {
    if (!err || typeof err !== "object") return false;
    const maybe = err as { code?: string; message?: string };
    return (
      maybe.code === "P2021" ||
      (typeof maybe.message === "string" &&
        maybe.message.includes("dp_continue_listening_v1") &&
        maybe.message.includes("does not exist"))
    );
  };

  const loadContinueRows = async () => {
    if (!userId) return [];
    const hasTable = await hasContinueListeningTable();
    if (!hasTable) {
      const metrics = await prisma.userMetric.findMany({
        where: {
          userId,
          eventType: { in: ["continue_listening", "audio_play"] },
          AND: [{ bookSlug: { not: null } }, { bookSlug: { not: "polyglot" } }],
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
      const rows: Array<{
        bookSlug: string;
        storySlug: string;
        progressSec: number | null;
        audioDurationSec: number | null;
      }> = [];

      for (const metric of metrics) {
        if (!metric.bookSlug) continue;
        const key = `${metric.bookSlug}:${metric.storySlug}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const meta =
          metric.metadata && typeof metric.metadata === "object"
            ? (metric.metadata as Record<string, unknown>)
            : null;

        rows.push({
          bookSlug: metric.bookSlug,
          storySlug: metric.storySlug,
          progressSec:
            meta && typeof meta.progressSec === "number" ? Math.round(meta.progressSec) : null,
          audioDurationSec:
            meta && typeof meta.audioDurationSec === "number" ? Math.round(meta.audioDurationSec) : null,
        });

        if (rows.length >= 8) break;
      }

      return rows.filter((row) => !isCompletedFromAudio(row.progressSec, row.audioDurationSec));
    }
    try {
      const rows = await prisma.continueListeningEntry.findMany({
        where: { userId, bookSlug: { not: "polyglot" } },
        select: {
          bookSlug: true,
          storySlug: true,
          progressSec: true,
          audioDurationSec: true,
        },
        orderBy: [{ lastPlayedAt: "desc" }, { bookSlug: "asc" }, { storySlug: "asc" }],
        take: 8,
      });
      return rows.filter((row) => !isCompletedFromAudio(row.progressSec, row.audioDurationSec));
    } catch (err) {
      if (isMissingContinueTableError(err)) {
        const metrics = await prisma.userMetric.findMany({
          where: {
            userId,
            eventType: { in: ["continue_listening", "audio_play"] },
            AND: [{ bookSlug: { not: null } }, { bookSlug: { not: "polyglot" } }],
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
        const rows: Array<{
          bookSlug: string;
          storySlug: string;
          progressSec: number | null;
          audioDurationSec: number | null;
        }> = [];

        for (const metric of metrics) {
          if (!metric.bookSlug) continue;
          const key = `${metric.bookSlug}:${metric.storySlug}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const meta =
            metric.metadata && typeof metric.metadata === "object"
              ? (metric.metadata as Record<string, unknown>)
              : null;

          rows.push({
            bookSlug: metric.bookSlug,
            storySlug: metric.storySlug,
            progressSec:
              meta && typeof meta.progressSec === "number" ? Math.round(meta.progressSec) : null,
            audioDurationSec:
              meta && typeof meta.audioDurationSec === "number"
                ? Math.round(meta.audioDurationSec)
                : null,
          });

          if (rows.length >= 8) break;
        }

        return rows.filter((row) => !isCompletedFromAudio(row.progressSec, row.audioDurationSec));
      }
      // Fallback para clientes Prisma desactualizados (sin progress/audioDuration).
      try {
        const rows = await prisma.continueListeningEntry.findMany({
          where: { userId, bookSlug: { not: "polyglot" } },
          select: {
            bookSlug: true,
            storySlug: true,
          },
          orderBy: [{ lastPlayedAt: "desc" }, { bookSlug: "asc" }, { storySlug: "asc" }],
          take: 8,
        });
        return rows
          .map((row) => ({
            ...row,
            progressSec: null,
            audioDurationSec: null,
          }))
          .filter((row) => !isCompletedFromAudio(row.progressSec, row.audioDurationSec));
      } catch (fallbackErr) {
        if (isMissingContinueTableError(fallbackErr)) return [];
        throw fallbackErr;
      }
    }
  };

  const [user, { latestBooks, latestStories, latestPolyglotStories }, featured, continueRows] =
    await Promise.all([
      userId ? currentUser() : Promise.resolve(null),
      getLatestHomeReleases({ limit: 10 }),
      getFeaturedStories(),
      loadContinueRows(),
    ]);

  const initialPlan = (user?.publicMetadata?.plan as string | undefined) ?? "free";
  const initialTargetLanguages = Array.isArray(user?.publicMetadata?.targetLanguages)
    ? (user?.publicMetadata?.targetLanguages as string[]).filter(
        (lang): lang is string => typeof lang === "string"
      )
    : [];
  const initialInterests = Array.isArray(user?.publicMetadata?.interests)
    ? (user?.publicMetadata?.interests as string[]).filter(
        (interest): interest is string => typeof interest === "string"
      )
    : [];

  return (
    <HomeClient
      latestBooks={latestBooks}
      latestStories={latestStories}
      latestPolyglotStories={latestPolyglotStories}
      featuredWeekSlug={featured.week?.slug ?? null}
      featuredDaySlug={featured.day?.slug ?? null}
      initialPlan={initialPlan}
      initialTargetLanguages={initialTargetLanguages}
      initialInterests={initialInterests}
      initialHasUser={Boolean(userId)}
      initialContinueListening={continueRows.map((row) => ({
        bookSlug: row.bookSlug,
        storySlug: row.storySlug,
        progressSec: row.progressSec ?? undefined,
        audioDurationSec: row.audioDurationSec ?? undefined,
      }))}
      continueLoadedOnServer={Boolean(userId)}
    />
  );
}
