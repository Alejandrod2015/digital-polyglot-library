import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import {
  getPublishedStandaloneStories,
  getStandaloneStoriesByIds,
  getStandaloneStoriesBySlugs,
  type PublicStandaloneStory,
} from "@/lib/standaloneStories";
import { shouldReadStandaloneFromStudio } from "@/lib/featureFlags";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getEffectivePlanForUserId } from "@/lib/effectiveAccess";
import { getDailyStories } from "@/lib/dailyJourneyStory";
import { isEntitledPlan, type EffectivePlan } from "@domain/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function withSourceHeader(res: NextResponse): NextResponse {
  res.headers.set(
    "X-Catalog-Source",
    shouldReadStandaloneFromStudio() ? "studio" : "sanity"
  );
  return res;
}

const PREVIEW_MAX_CHARS = 650;

function buildPlainPreview(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= PREVIEW_MAX_CHARS) return normalized;
  const clipped = normalized.slice(0, PREVIEW_MAX_CHARS).replace(/\s+\S*$/, "").trim();
  return clipped ? `${clipped}…` : "";
}

export type LockedStandaloneStory = PublicStandaloneStory & { locked?: boolean };

/**
 * Muro del modelo 2026-09. Este endpoint era el agujero del candado: servia
 * texto, vocab y audio completos sin sesion ni plan (y es lo que lee la app
 * movil). Ahora lo abierto es: todo para planes con derecho (incluida la
 * gracia beta), el tema 1 del journey para cuentas basic, y la historia del
 * dia para cualquiera. El resto viaja como preview sin audio con locked=true.
 */
async function lockStoriesForPlan(
  stories: PublicStandaloneStory[],
  plan: EffectivePlan
): Promise<LockedStandaloneStory[]> {
  if (isEntitledPlan(plan)) return stories;

  const dailySlugs = new Set((await getDailyStories()).map((story) => story.slug));

  let firstTopicSlugs = new Set<string>();
  if (plan === "basic") {
    const slugs = stories.map((story) => story.slug).filter(Boolean);
    if (slugs.length > 0) {
      const rows = await prisma.journeyStory
        .findMany({
          where: { slug: { in: slugs }, status: "published" },
          select: { slug: true, topic: true, journey: { select: { topics: true } } },
        })
        .catch(() => []);
      firstTopicSlugs = new Set(
        rows
          .filter((row) => row.journey.topics[0] === row.topic)
          .map((row) => row.slug as string)
      );
    }
  }

  return stories.map((story) => {
    const open =
      dailySlugs.has(story.slug) || (plan === "basic" && firstTopicSlugs.has(story.slug));
    if (open) return story;
    return {
      ...story,
      text: buildPlainPreview(story.text),
      vocabRaw: null,
      audioUrl: null,
      locked: true,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const mobileSession = getMobileSessionFromRequest(req);
    const { userId: clerkUserId } = getAuth(req);
    const userId = mobileSession?.sub ?? clerkUserId ?? null;
    const plan = await getEffectivePlanForUserId(userId);

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");
    const slugsParam = searchParams.get("slugs");

    if (idsParam) {
      const ids = Array.from(new Set(idsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await lockStoriesForPlan(await getStandaloneStoriesByIds(ids), plan);
      return withSourceHeader(NextResponse.json({ stories }));
    }

    if (slugsParam) {
      const slugs = Array.from(new Set(slugsParam.split(",").map((item) => item.trim()).filter(Boolean)));
      const stories = await lockStoriesForPlan(await getStandaloneStoriesBySlugs(slugs), plan);
      return withSourceHeader(NextResponse.json({ stories }));
    }

    const stories = await lockStoriesForPlan(await getPublishedStandaloneStories(), plan);
    return withSourceHeader(NextResponse.json({ stories }));
  } catch (error) {
    console.error("Error fetching standalone stories:", error);
    return NextResponse.json({ error: "Failed to load standalone stories" }, { status: 500 });
  }
}
