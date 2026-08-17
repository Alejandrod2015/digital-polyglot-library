import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Invalida la caché de nombres de tema.
 *
 * WHY: `getTopicLabelBySlug` (src/app/journey/journeyData.ts) cachea el MAPA
 * ENTERO de la tabla de temas con `unstable_cache`, `revalidate: 3600` y tag
 * `topic-labels`. Es una foto de un instante: los temas creados o renombrados
 * después caen a `prettifyTopicLabel(slug)` hasta una hora, y en pantalla se
 * lee "Fiestas And Traditions" en vez de "Fiestas & Traditions". Nadie llamaba
 * nunca a `revalidateTag("topic-labels")`, así que la única forma de forzarlo
 * era un deploy, o borrar `.next/cache` en local. Esto es esa llamada.
 *
 *   curl -X POST http://localhost:3000/api/topics/revalidate
 *
 * No lee ni escribe datos: solo tira la caché. Por eso no lleva auth; lo peor
 * que puede hacer un desconocido es obligar a releer una tabla de 100 filas.
 */
export async function POST() {
  revalidateTag("topic-labels");
  return NextResponse.json({ revalidated: "topic-labels" });
}
