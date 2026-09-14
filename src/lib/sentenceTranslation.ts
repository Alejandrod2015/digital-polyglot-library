/**
 * La traduccion al ingles de la frase de un ejercicio de contexto.
 *
 * Los sets curados la guardan en `StoryPracticeExercise.payload.translation`
 * con `_____` en el sitio de la palabra, porque en `fill_blank` la respuesta
 * todavia no se conoce cuando se lee la frase. Al RESOLVER si se conoce, y ahi
 * el hueco puede rellenarse con la glosa corta de la respuesta.
 *
 * Vive aparte y sin dependencias para que la use tanto la ruta que sirve los
 * favoritos al movil como un test, sin arrastrar prisma ni el catalogo.
 */

/** El hueco tal como lo deja el generador: tres guiones bajos o mas. */
const HUECO = /_{3,}/;

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function listaDeTextos(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => (typeof item === "string" ? item : "")) : [];
}

/**
 * Devuelve la traduccion de la frase con el hueco relleno cuando se puede
 * saber que glosa corresponde a la respuesta, y con el hueco tal cual cuando
 * no. Devuelve null si no hay traduccion que ensenar.
 *
 * El criterio para encontrar la glosa es el MISMO que usa la web al revelar
 * (`options.indexOf(answer)` sobre `optionTranslations`), y a proposito: si
 * los dos divergen, la misma frase se traduce distinto en el telefono y en el
 * navegador.
 */
export function fillSentenceTranslationBlank(
  translation: unknown,
  answer: unknown,
  options: unknown,
  optionTranslations: unknown
): string | null {
  const frase = texto(translation);
  if (!frase) return null;
  if (!HUECO.test(frase)) return frase;

  const respuesta = texto(answer);
  if (!respuesta) return frase;

  const opciones = listaDeTextos(options);
  const glosas = listaDeTextos(optionTranslations);
  const indice = opciones.findIndex((opcion) => opcion.trim() === respuesta);
  if (indice < 0) return frase;

  const glosa = texto(glosas[indice]);
  if (!glosa) return frase;

  return frase.replace(HUECO, glosa);
}
