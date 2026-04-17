// /src/lib/getFeaturedStory.ts
import { books } from "@/data/books";
import { cache } from "react";

export type FeaturedStoryRef = {
  slug: string;
  period: "day" | "week";
  periodKey: string;
};

export type FeaturedStoryData = {
  title: string;
  slug: string;
  focus?: string;
  book: {
    title: string;
    slug: string;
    cover: string;
    description: string;
    language?: string;
    level?: string;
    topic?: string;
  };
};

function getISOWeekKey(date: Date, tz: string): string {
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  const firstJan = new Date(local.getFullYear(), 0, 1);
  const days = Math.floor((local.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((local.getDay() + 1 + days) / 7);
  return `${local.getFullYear()}-W${week}`;
}

function allStoryRefs(): Array<{ slug: string }> {
  return Object.values(books).flatMap((book) =>
    (book.stories ?? []).map((story) => ({ slug: story.slug }))
  );
}

export function getFeaturedStoryDataBySlug(slug: string): FeaturedStoryData | null {
  for (const book of Object.values(books)) {
    const story = book.stories.find((s) => s.slug === slug);
    if (!story) continue;
    const storyCoverUrl =
      typeof (story as { coverUrl?: unknown }).coverUrl === "string"
        ? ((story as { coverUrl?: string }).coverUrl ?? "").trim() || undefined
        : undefined;
    return {
      title: story.title,
      slug: story.slug,
      focus: undefined,
      book: {
        title: book.title,
        slug: book.slug,
        cover:
          story.cover ??
          storyCoverUrl ??
          book.cover ??
          "/covers/default.jpg",
        description: book.description,
        language: story.language ?? book.language,
        level: story.level ?? book.level,
        topic: story.topic ?? book.topic,
      },
    };
  }
  return null;
}

/**
 * Selección determinista de historia destacada basada en fecha/periodo.
 * No lee ni escribe en Sanity para evitar impacto en producción sin deploy.
 */
export async function getFeaturedStory(
  period: "day" | "week" = "week",
  tz: string = "UTC"
): Promise<FeaturedStoryRef | null> {
  try {
    const now = new Date();
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const periodKey = period === "week" ? getISOWeekKey(local, tz) : local.toISOString().slice(0, 10);

    const stories = allStoryRefs();
    if (stories.length === 0) return null;

    const seed = [...periodKey].reduce((a, c) => a + c.charCodeAt(0), 0);
    const index = seed % stories.length;
    const slug = stories[index]?.slug;

    if (!slug) return null;
    return { slug, period, periodKey };
  } catch (err) {
    console.error("[featured] Failed to resolve featured story:", err);
    return null;
  }
}

export const getFeaturedStories = cache(async (tz: string = "UTC") => {
  const [week, day] = await Promise.all([getFeaturedStory("week", tz), getFeaturedStory("day", tz)]);
  return { week, day };
});
