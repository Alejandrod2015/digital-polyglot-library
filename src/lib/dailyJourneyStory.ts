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
  /**
   * Etiqueta del tema, leida de la tabla de temas. El heroe de la home la usa
   * de subtitulo, donde antes iba el titulo del libro. No vale title-casear el
   * slug: "helping-and-favours" saldria como "Helping And Favours" y el nombre
   * de un tema lleva ampersand, nunca "And".
   */
  topicLabel: string | null;
  /** Variante del journey (spain, latam, brazil), para la insignia de region. */
  variant: string | null;
  /** Palabras nuevas de la historia, para la ficha del heroe. */
  vocabCount: number | null;
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
      vocabCount: true,
      journeyId: true,
      journey: { select: { language: true, variant: true } },
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
  const chosen: Array<{ language: string; row: (typeof rows)[number] }> = [];
  for (const [language, list] of byLanguage) {
    const index = hashString(`${key}:${language}`) % list.length;
    const pick = list[index];
    if (!pick?.slug || !pick.title) continue;
    chosen.push({ language, row: pick });
  }

  // Una sola consulta para las etiquetas de los temas elegidos: son tantas
  // como idiomas vivos, no como historias.
  const topicLabels = new Map<string, string>();
  const topicSlugs = [...new Set(chosen.map((c) => c.row.topic).filter(Boolean))];
  if (topicSlugs.length > 0) {
    const topics = await prisma.topic
      .findMany({ where: { slug: { in: topicSlugs } }, select: { slug: true, label: true } })
      .catch(() => []);
    for (const t of topics) topicLabels.set(t.slug, t.label);
  }

  const picks: DailyStory[] = chosen.map(({ language, row }) => ({
    language,
    slug: row.slug as string,
    title: row.title as string,
    level: row.level,
    coverUrl: row.coverUrl,
    topicLabel: topicLabels.get(row.topic) ?? null,
    variant: row.journey.variant ?? null,
    vocabCount: row.vocabCount,
  }));

  return picks.sort((a, b) => a.language.localeCompare(b.language));
});

export async function isDailyStorySlug(slug: string): Promise<boolean> {
  if (!slug) return false;
  const daily = await getDailyStories();
  return daily.some((story) => story.slug === slug);
}
