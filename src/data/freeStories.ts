// /src/data/freeStories.ts

import { createClient } from 'next-sanity';

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: '2025-01-01',
  useCdn: true,
});

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
