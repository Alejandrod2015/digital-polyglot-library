// /src/data/freeStories.ts
import { client, writeClient } from "@/sanity/lib/client";

/**
 * Obtiene los slugs de las historias promocionales (manual o automático).
 * - Si hay historias seleccionadas manualmente → usa esas.
 * - Si no hay → elige una aleatoria entre las publicadas, sin repetir
 *   hasta agotar todas (registradas en `usedStories`).
 */
export async function getFreeStorySlugs(): Promise<string[]> {
  try {
    // 🧠 1. Leer documento de marketingSettings
    const settings = await client.fetch<{
      promotionalStories?: { slug?: { current?: string } }[];
      usedStories?: string[];
    } | null>(
      `*[_id == "marketingSettings"][0]{
        "promotionalStories": promotionalStories[]->{ slug },
        usedStories
      }`
    );

    // --- MODO MANUAL ---
    const manualSlugs =
      settings?.promotionalStories
        ?.map((s) => s?.slug?.current)
        .filter((slug): slug is string => typeof slug === "string") ?? [];

    if (manualSlugs.length > 0) {
      return manualSlugs;
    }

    // --- MODO AUTOMÁTICO ---
    const used = new Set(settings?.usedStories ?? []);

    // Obtener todas las historias publicadas (solo sus slugs)
    const allStories = await client.fetch<string[]>(
      `*[_type == "story" && published == true].slug.current`
    );

    const available = allStories.filter(
      (slug) => slug && !used.has(slug)
    );

    // Si no hay historias disponibles → reiniciar ciclo
    const pool = available.length > 0 ? available : allStories;
    const randomSlug = pool[Math.floor(Math.random() * pool.length)];

    // Actualizar usedStories en Sanity (solo si hay token configurado)
    if (process.env.SANITY_API_WRITE_TOKEN) {
      try {
        const newUsed = available.length > 0
          ? [...used, randomSlug]
          : [randomSlug]; // reinicia si ya estaban todas

        await writeClient
          .patch("marketingSettings")
          .set({ usedStories: newUsed })
          .commit({ autoGenerateArrayKeys: true });
      } catch (err) {
        console.warn("⚠️ No se pudo actualizar usedStories:", err);
      }
    } else {
      console.warn("⚠️ SANITY_API_WRITE_TOKEN no definido, no se actualizarán usedStories.");
    }

    return [randomSlug];
  } catch (err) {
    console.error("💥 Error en getFreeStorySlugs:", err);
    return [];
  }
}
