/**
 * Qué cuenta como actividad de una persona en las métricas.
 *
 * El DAU y el WAU se calculaban sobre CUALQUIER fila de `UserMetric`, y en esa
 * tabla no solo escriben los usuarios: también escriben los crons cuando MANDAN
 * algo. `lifecycleEngine` sella un `lifecycle_email_sent` por destinatario, y
 * los tres empujones (`journeyBridgePush`, `nextStoryPush`, `resumeStoryPush`)
 * sellan su `*_push_sent` aunque el aviso no se llegue a abrir.
 *
 * El resultado era una cifra que subía sola: el 2026-09-07 el panel decía 10
 * personas en el DAU, nueve de ellas con un único evento a las 09:00:3x, que es
 * cuando corrió `lifecycle-emails`. Cuatro habían abierto la app; a las otras
 * seis les habíamos escrito nosotros. Un correo que sale no es alguien que
 * entra, así que estos eventos no cuentan como actividad.
 *
 * La lista de los cuatro vive en `SERVER_WRITTEN_METRIC_EVENTS`
 * (`metricsRetention.ts`), que ya los enumeraba para la retención por cohorte.
 * Aquí no se copia: se importa. El filtro va por SUFIJO además de por la lista
 * para que un quinto evento `*_sent` quede fuera desde el día que se escriba,
 * sin depender de que alguien se acuerde de apuntarlo en los dos sitios.
 */
import { SERVER_WRITTEN_METRIC_EVENTS } from "./metricsRetention";

/** Sufijo de todo evento que registra algo que SALE hacia el usuario. */
export const OUTBOUND_EVENT_SUFFIX = "_sent";

/** ¿Lo escribió un cron al mandar algo, en vez de la persona al usar la app? */
export function isOutboundEvent(eventType: string): boolean {
  return (
    eventType.endsWith(OUTBOUND_EVENT_SUFFIX) ||
    SERVER_WRITTEN_METRIC_EVENTS.includes(eventType)
  );
}

/**
 * Filtro de Prisma para contar solo actividad de verdad. Va en el `where` de
 * cualquier consulta que responda "cuánta gente estuvo aquí".
 */
export const ACTIVITY_EVENT_WHERE = {
  eventType: {
    not: { endsWith: OUTBOUND_EVENT_SUFFIX },
    notIn: SERVER_WRITTEN_METRIC_EVENTS,
  },
} as const;

/**
 * Los eventos que llevan un punto de progreso dentro. De cada historia cuenta
 * el punto MÁS LEJANO alcanzado, nunca la suma: quien vuelve atrás y reescucha
 * no ha escuchado dos veces.
 */
export const PROGRESS_EVENT_TYPES = [
  "audio_pause",
  "audio_complete",
  "continue_listening",
] as const;

export function isProgressEvent(eventType: string): boolean {
  return (PROGRESS_EVENT_TYPES as readonly string[]).includes(eventType);
}
