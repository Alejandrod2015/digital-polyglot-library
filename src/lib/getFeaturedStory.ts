// /src/lib/getFeaturedStory.ts
import { client } from "@/sanity/lib/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";

/**
 * Obtiene la historia destacada (semanal o diaria)
 * según el documento `storyScheduler` en Sanity.
 * Si no hay historia configurada y el modo automático está activo,
 * elige una historia publicada aleatoria.
 */
export async function getFeaturedStory(
  period: "day" | "week" = "week",
  tz: string = "UTC"
) {
  try {
    // 🕐 Calcular fecha local del usuario
    const now = new Date();
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));

    // Clave temporal (determinista)
    const key =
      period === "week"
        ? `${local.getFullYear()}-W${Math.ceil(
            (local.getDate() - local.getDay() + 1) / 7
          )}`
        : local.toISOString().slice(0, 10);

    // 🧠 Obtener documento único de configuración
    const scheduler = await getStoryScheduler();

    if (!scheduler) {
      console.warn("⚠️ No se encontró storyScheduler en Sanity.");
      return await fallbackStory(period, key);
    }

    // --- LÓGICA SEMANAL ---
    if (period === "week") {
      const current = scheduler.currentWeeklyStory?.slug;
      if (current) return { slug: current, period, periodKey: key };

      const next = scheduler.nextWeeklyStory?.slug;
      if (next) return { slug: next, period, periodKey: key };

      if (scheduler.autoSelectWeekly) {
        return await fallbackStory(period, key);
      }
      return null;
    }

    // --- LÓGICA DIARIA ---
    if (period === "day") {
      const current = scheduler.currentDailyStory?.slug;
      if (current) return { slug: current, period, periodKey: key };

      const next = scheduler.nextDailyStory?.slug;
      if (next) return { slug: next, period, periodKey: key };

      if (scheduler.autoSelectDaily) {
        return await fallbackStory(period, key);
      }
      return null;
    }

    return null;
  } catch (err) {
    console.error("💥 Error en getFeaturedStory:", err);
    return null;
  }
}

export const getFeaturedStories = cache(async (tz: string = "UTC") => {
  const [week, day] = await Promise.all([
    getFeaturedStory("week", tz),
    getFeaturedStory("day", tz),
  ]);
  return { week, day };
});

/**
 * 🌀 Fallback determinista: usa la fecha (día/semana) como semilla
 * para seleccionar una historia publicada, sin escribir en Sanity.
 */
async function fallbackStory(period: "day" | "week", key: string) {
  const stories = await getPublishedStorySlugs();

  if (!stories.length) return null;

  const seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  const index = seed % stories.length;
  const slug = stories[index].slug;

  return slug ? { slug, period, periodKey: key } : null;
}

type StoryScheduler = {
  currentWeeklyStory?: { slug?: string } | null;
  nextWeeklyStory?: { slug?: string } | null;
  currentDailyStory?: { slug?: string } | null;
  nextDailyStory?: { slug?: string } | null;
  autoSelectWeekly?: boolean;
  autoSelectDaily?: boolean;
} | null;

const getStoryScheduler = unstable_cache(
  async (): Promise<StoryScheduler> =>
    client.fetch<StoryScheduler>(
      `*[_type == "storyScheduler"][0]{
        currentWeeklyStory->{
          "slug": slug.current
        },
        nextWeeklyStory->{
          "slug": slug.current
        },
        currentDailyStory->{
          "slug": slug.current
        },
        nextDailyStory->{
          "slug": slug.current
        },
        autoSelectWeekly,
        autoSelectDaily
      }`
    ),
  ["featured-story-scheduler-v1"],
  { revalidate: 300, tags: ["story-scheduler"] }
);

const getPublishedStorySlugs = unstable_cache(
  async (): Promise<{ slug?: string }[]> =>
    client.fetch<{ slug?: string }[]>(
      `*[_type == "story" && published == true && defined(slug.current)]{
        "slug": slug.current
      }`
    ),
  ["featured-story-slugs-v1"],
  { revalidate: 300, tags: ["stories"] }
);
