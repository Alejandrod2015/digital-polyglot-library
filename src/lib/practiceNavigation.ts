/**
 * Marca de "vengo de una pantalla de la app", para que la práctica sepa cómo
 * salir sin dejar al usuario dando vueltas.
 *
 * EL PROBLEMA: al terminar los ejercicios de una historia, salir hacía
 * `location.href = /stories/x`, que APILA la historia encima de la práctica.
 * La flecha de atrás de la historia retrocedía a la práctica, la práctica se
 * auto-abría de nuevo, y su flecha volvía a apilar la historia: historia,
 * ejercicios, historia, ejercicios, sin fondo.
 *
 * La salida correcta es RETROCEDER, que consume la entrada que creó la propia
 * entrada a práctica. Pero retroceder a ciegas es peligroso: si alguien abre
 * un enlace de práctica compartido en una pestaña donde venía de otra web, un
 * `history.back()` lo saca del sitio. Y el historial no se puede leer.
 *
 * Por eso quien navega a la práctica deja esta marca al hacerlo, y la práctica
 * la lee y la borra al montar: con marca, retrocede; sin marca, navega con
 * `replace`, que sustituye la práctica en vez de apilarla. Ninguna de las dos
 * ramas puede volver a formar el bucle.
 *
 * `sessionStorage` y no una cookie ni un parámetro en la URL: muere con la
 * pestaña, no viaja en enlaces compartidos y no ensucia la URL que el usuario
 * pueda copiar.
 */
export const PRACTICE_FROM_APP_KEY = "dpl:practice-from-app";

/** Llamar JUSTO al navegar a `/practice` desde una pantalla de la app. */
export function markPracticeEntryFromApp() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PRACTICE_FROM_APP_KEY, "1");
  } catch {
    // Modo privado o almacenamiento bloqueado: sin marca, la práctica sale
    // con `replace`, que es la rama segura.
  }
}
