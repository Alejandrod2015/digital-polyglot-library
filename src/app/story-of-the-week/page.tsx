// /src/app/story-of-the-week/page.tsx
import { redirect } from "next/navigation";

/**
 * La "historia de la semana" ya no existe como concepto.
 *
 * Salia de `getFeaturedStory("week")`, un hash sobre el catalogo congelado de
 * `src/data/books`, con dos fallos encima. El primero: la clave de semana la
 * calculaba a mano con `local.getDay()`, asi que saltaba con el dia de la
 * semana en vez de con la semana. El sabado 2026-09-05 mando a `2026-W37` y
 * puso a todo el mundo, pidiera el idioma que pidiera, en una historia
 * italiana de nivel intermedio; el domingo volvio a `2026-W36`. El segundo:
 * `canAccessStoryContent` ya no tiene `isWeeklyStory` desde el muro del
 * 2026-09, asi que esta pagina anunciaba como gratis una historia que ya no
 * abria nadie sin plan.
 *
 * Lo que si existe es una historia del dia por idioma, sacada de journeys
 * vivos, y es la unica que el candado abre sin plan. Esta ruta lleva ahi.
 */
export default function StoryOfTheWeekPage() {
  redirect("/story-of-the-day");
}
