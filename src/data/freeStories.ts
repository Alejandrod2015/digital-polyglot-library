// /src/data/freeStories.ts
import { client } from '@/sanity/lib/client';

/**
 * Obtiene los slugs de las historias promocionales desde Sanity.
 * Incluye un fallback seguro si el documento no existe.
 */
export async function getFreeStorySlugs(): Promise<string[]> {
  try {
    const slugs = await client.fetch<string[] | null>(
      `*[_type == "marketingSettings"][0].promotionalStories[]->slug.current`
    );
    return Array.isArray(slugs) ? slugs.filter(Boolean) : [];
  } catch (_err) {
    console.warn('⚠️ No se pudo obtener promotionalStories desde Sanity.');
    return [];
  }
}
