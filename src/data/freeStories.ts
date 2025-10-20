// /src/data/freeStories.ts
import { client } from "@/sanity/lib/client";

/**
 * Obtiene los slugs de historias gratuitas.
 * - Si hay historias publicadas → elige una aleatoria.
 * - Si no hay → devuelve un arreglo vacío.
 * 
 * En el futuro puede integrarse con una API que fije una
 * “Story of the Week” o “Story of the Day” sin modificar Sanity.
 */
export async function getFreeStorySlugs(): Promise<string[]> {
  try {
    // Obtener todos los slugs de historias publicadas
    const allStories = await client.fetch<string[]>(
      `*[_type == "story" && published == true].slug.current`
    );

    if (!allStories || allStories.length === 0) {
      console.warn("⚠️ No hay historias publicadas.");
      return [];
    }

    // Seleccionar una historia aleatoria
    const randomSlug =
      allStories[Math.floor(Math.random() * allStories.length)];

    return [randomSlug];
  } catch (err) {
    console.error("💥 Error en getFreeStorySlugs:", err);
    return [];
  }
}
