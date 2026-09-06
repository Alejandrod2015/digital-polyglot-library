import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Historia del dia: una por idioma, elegida de forma determinista entre las
 * historias publicadas (con audio) de journeys ACTIVOS. Es la unica lectura
 * completa para visitantes sin cuenta; sustituye a la "featured story" vieja,
 * que rotaba sobre el catalogo congelado de libros (getFeaturedStory.ts).
 */

export type DailyStory = {
  language: string;
  slug: string;
  title: string;
  level: string;
  coverUrl: string | null;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export const getDailyStories = cache(async (date?: Date): Promise<DailyStory[]> => {
  const rows = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      slug: { not: null },
      title: { not: null },
      audioUrl: { not: null },
      journey: { status: "active" },
    },
    select: {
      slug: true,
      title: true,
      level: true,
      topic: true,
      slotIndex: true,
      coverUrl: true,
      journeyId: true,
      journey: { select: { language: true } },
    },
    orderBy: [{ journeyId: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  const byLanguage = new Map<string, typeof rows>();
  for (const row of rows) {
    const language = (row.journey.language ?? "").trim().toLowerCase();
    if (!language) continue;
    const list = byLanguage.get(language) ?? [];
    list.push(row);
    byLanguage.set(language, list);
  }

  const key = dayKey(date ?? new Date());
  const picks: DailyStory[] = [];
  for (const [language, list] of byLanguage) {
    const index = hashString(`${key}:${language}`) % list.length;
    const pick = list[index];
    if (!pick?.slug || !pick.title) continue;
    picks.push({
      language,
      slug: pick.slug,
      title: pick.title,
      level: pick.level,
      coverUrl: pick.coverUrl,
    });
  }

  return picks.sort((a, b) => a.language.localeCompare(b.language));
});

export async function isDailyStorySlug(slug: string): Promise<boolean> {
  if (!slug) return false;
  const daily = await getDailyStories();
  return daily.some((story) => story.slug === slug);
}
