// /src/lib/getFeaturedStory.ts
import { client } from "@/sanity/lib/client";

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
    const scheduler = await client.fetch<{
      currentWeeklyStory?: { slug?: { current?: string } } | null;
      nextWeeklyStory?: { slug?: { current?: string } } | null;
      currentDailyStory?: { slug?: { current?: string } } | null;
      nextDailyStory?: { slug?: { current?: string } } | null;
      autoSelectWeekly?: boolean;
      autoSelectDaily?: boolean;
    } | null>(
      `*[_type == "storyScheduler"][0]{
        currentWeeklyStory->{ "slug": slug },
        nextWeeklyStory->{ "slug": slug },
        currentDailyStory->{ "slug": slug },
        nextDailyStory->{ "slug": slug },
        autoSelectWeekly,
        autoSelectDaily
      }`
    );

    if (!scheduler) {
      console.warn("⚠️ No se encontró storyScheduler en Sanity.");
      return await fallbackStory(period, key);
    }

    // --- LÓGICA SEMANAL ---
    if (period === "week") {
  const current = scheduler.currentWeeklyStory?.slug?.current;
  if (current) return { slug: current, period, periodKey: key };

  const next = scheduler.nextWeeklyStory?.slug?.current;
  if (next) return { slug: next, period, periodKey: key };

  if (scheduler.autoSelectWeekly) {
    return await fallbackStory(period, key);
  }
  return null;
}

    // --- LÓGICA DIARIA ---
    if (period === "day") {
      const slug =
        scheduler.currentDailyStory?.slug?.current ||
        scheduler.nextDailyStory?.slug?.current;
      if (slug) return { slug, period, periodKey: key };

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

/**
 * 🌀 Fallback determinista: usa la fecha (día/semana) como semilla
 * para seleccionar una historia publicada, sin escribir en Sanity.
 */
async function fallbackStory(period: "day" | "week", key: string) {
  const stories = await client.fetch<{ slug?: { current?: string } }[]>(
    `*[_type == "story" && defined(slug.current)]{ "slug": slug }`
  );

  if (!stories.length) return null;

  const seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  const index = seed % stories.length;
  const slug = stories[index].slug?.current;

  return slug ? { slug, period, periodKey: key } : null;
}
