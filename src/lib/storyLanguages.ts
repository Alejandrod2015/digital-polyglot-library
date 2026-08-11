import { prisma } from "@/lib/prisma";
import { canonicalLanguageName } from "@/lib/languageNames";

/**
 * slug de historia -> idioma, mirando las cuatro tablas donde vive contenido.
 *
 * Existe porque el idioma de una historia se resolvía ya en dos sitios con
 * cobertura distinta, y ninguno miraba `JourneyStory`, que es de donde salen
 * unas 100 de las ~230 historias que la gente abre de verdad. Un resolutor que
 * se deja fuera la fuente más usada devuelve "no lo sé" para casi la mitad del
 * catálogo.
 *
 * Devuelve el nombre en inglés ("Spanish", "German"), no el código, porque es
 * lo que escribe el onboarding en Clerk y estos valores se muestran uno al lado
 * del otro.
 */

export async function resolveStoryLanguages(
  slugs: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  if (unique.length === 0) return out;

  const [catalog, journey, standalone, userStories] = await Promise.all([
    prisma.catalogStory.findMany({
      where: { slug: { in: unique } },
      select: { slug: true, language: true, book: { select: { language: true } } },
    }),
    prisma.journeyStory.findMany({
      where: { slug: { in: unique } },
      select: { slug: true, journey: { select: { language: true } } },
    }),
    prisma.standaloneStory.findMany({
      where: { OR: [{ slug: { in: unique } }, { id: { in: unique } }] },
      select: { id: true, slug: true, language: true },
    }),
    prisma.userStory.findMany({
      where: { slug: { in: unique } },
      select: { slug: true, language: true },
    }),
  ]);

  const put = (slug: string | null, lang: string | null | undefined) => {
    const name = canonicalLanguageName(lang);
    if (!slug || !name || out.has(slug)) return;
    out.set(slug, name);
  };

  for (const r of catalog) put(r.slug, r.language ?? r.book?.language);
  for (const r of journey) put(r.slug, r.journey?.language);
  for (const r of standalone) {
    put(r.slug, r.language);
    put(r.id, r.language);
  }
  for (const r of userStories) put(r.slug, r.language);

  return out;
}
