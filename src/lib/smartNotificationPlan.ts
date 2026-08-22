// Plan de notificaciones inteligentes (canon).
//
// Cada fila es UN disparador: una señal que la base ya guarda, una ventana de
// tiempo y un texto concreto. Nada de esto pide tabla nueva; todo se apoya en
// `UserMetric`, `Favorite`, `ContinueListeningEntry`, `JourneyStory`,
// `Journey` y `StoryRating`.
//
// El único disparador construido es el puente al siguiente journey
// (`journeyBridgePush.ts`), y su forma es la plantilla del resto: ventana de
// horas en vez de "al día siguiente" exacto, descartes con motivo, una sola
// vez por par marcada con una fila en `UserMetric`, y opt-in por
// `notificationPrefs`.
//
// Este fichero es solo datos: lo lee la pestaña "Plan" de Studio
// (/studio/notificaciones) para pintar el mapa. Cuando un disparador se
// construya, cambia su `status` a "live" y apunta el módulo en `builtIn`.

import type { NotificationTypeKey } from "@/lib/notifications";

/** En qué se apoya el disparador dentro del recorrido del alumno. */
export type PlanGroup = "continuidad" | "memoria" | "descubrimiento" | "vuelta";

/**
 * live      = construido y enviando.
 * ready     = la señal existe hoy; es escribir el selector y el cron.
 * needsWork = falta un dato o una decisión antes de poder construirlo.
 */
export type PlanStatus = "live" | "ready" | "needsWork";

export type SmartNotification = {
  id: string;
  /** Orden de construcción acordado; 1 es lo primero. */
  priority: number;
  group: PlanGroup;
  label: string;
  /** Qué lo dispara, en términos de columnas reales. */
  signal: string;
  /** Ventana y frecuencia con la que puede repetirse. */
  window: string;
  /** Texto de ejemplo, en inglés como el resto de la interfaz móvil. */
  copy: { title: string; body: string };
  /** A dónde lleva el toque. */
  destination: string;
  /** Tipo de opt-in bajo el que se filtra al usuario. */
  optIn: NotificationTypeKey;
  status: PlanStatus;
  /** Módulo que ya lo implementa, si lo hay. */
  builtIn?: string;
  /** Lo que falta, o el motivo por el que se ordena aquí. */
  note?: string;
};

export const PLAN_GROUP_LABEL: Record<PlanGroup, string> = {
  continuidad: "Continuidad: terminar lo empezado",
  memoria: "Memoria: que el vocabulario no se caiga",
  descubrimiento: "Descubrimiento: lo nuevo que le toca",
  vuelta: "Vuelta: quien se fue o nunca empezó",
};

export const PLAN_GROUP_ORDER: PlanGroup[] = [
  "continuidad",
  "memoria",
  "descubrimiento",
  "vuelta",
];

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  live: "Enviando",
  ready: "Señal lista",
  needsWork: "Falta un dato",
};

export const SMART_NOTIFICATIONS: SmartNotification[] = [
  {
    id: "resume_story",
    priority: 1,
    group: "continuidad",
    label: "Historia a medias",
    signal: "ContinueListeningEntry entre el 20% y el 85%, y lastPlayedAt de hace 2 días o más",
    window: "Una vez por historia; se cancela si la retoma",
    copy: {
      title: "El mercado is still open",
      body: "Four minutes to the end, and Marta has not paid yet.",
    },
    destination: "La historia, en el segundo exacto en que la dejó",
    optIn: "daily_reminder",
    status: "ready",
    builtIn:
      "src/lib/resumeStoryPush.ts + cron a las 18:00, en seco hasta RESUME_STORY_PUSH_ENABLED=1",
    note: "Escrito y medido en seco. Ojo: la fila de progreso NO se borra al terminar la historia, así que un audio_complete posterior la descarta; los eventos de los 30 min siguientes son de la misma sesión y no cuentan como vuelta.",
  },
  {
    id: "forgotten_word",
    priority: 2,
    group: "memoria",
    label: "Palabra que quizás olvidaste",
    signal: "Favorite.nextReviewAt vencida, o vocab_clicked de hace 14 días sin repaso posterior",
    window: "Como mucho dos por semana, nunca la misma palabra en 30 días",
    copy: {
      title: "Madrugar",
      body: "A lovely word you met in Lyon. Still remember it?",
    },
    destination: "La ficha de la palabra, con la oración de la historia donde la vio",
    optIn: "practice_due",
    status: "ready",
    note: "Favorite ya tiene nextReviewAt, lastReviewedAt y streak; el repaso espaciado está a medio construir.",
  },
  {
    id: "next_story_teaser",
    priority: 3,
    group: "continuidad",
    label: "Teaser de la siguiente historia",
    signal: "Historia N completada y la N+1 del mismo tema sin abrir 3 días después",
    window: "Una vez por historia",
    copy: {
      title: "About those keys",
      body: "Marta still has not explained them. The next story does.",
    },
    destination: "La historia siguiente",
    optIn: "new_content",
    status: "ready",
    note: "El gancho sale de JourneyStory.synopsis, que ya se escribe para cada historia.",
  },
  {
    id: "almost_done",
    priority: 4,
    group: "continuidad",
    label: "Estás a dos historias",
    signal: "Quedan una o dos historias publicadas del journey y 4 días sin ningún evento",
    window: "Una vez por journey",
    copy: {
      title: "Lyon is almost yours",
      body: "Two stories to the end. The last one is the good one.",
    },
    destination: "La primera historia que le falta",
    optIn: "daily_reminder",
    status: "ready",
    note: "Reusa el contador de completadas de journeyProgress, el mismo que usa el puente.",
  },
  {
    id: "journey_bridge",
    priority: 5,
    group: "descubrimiento",
    label: "Puente al siguiente journey",
    signal: "Journey terminado, el siguiente del mismo tipo sin abrir, entre 20 y 120 horas después",
    window: "Una sola vez por par de journeys",
    copy: {
      title: "Spanish A1 is open",
      body: "21 new stories, one step up from where you just were.",
    },
    destination: "La portada del journey siguiente",
    optIn: "new_content",
    status: "live",
    builtIn: "src/lib/journeyBridgePush.ts (cron diario a las 17:00); el texto sale de bridgeCopy()",
  },
  {
    id: "practice_after_story",
    priority: 6,
    group: "memoria",
    label: "Práctica de lo que acaba de leer",
    signal: "Historia completada y su StoryPracticeSet sin abrir en 24 horas",
    window: "Una vez por historia",
    copy: {
      title: "How much of it stuck?",
      body: "Ten quick questions from yesterday's story. Two minutes.",
    },
    destination: "El set de práctica de esa historia",
    optIn: "practice_due",
    status: "ready",
  },
  {
    id: "failed_word",
    priority: 7,
    group: "memoria",
    label: "Palabra que fallaste",
    signal: "practice_session con fallo en esa palabra, 48 horas después",
    window: "Un reintento por palabra",
    copy: {
      title: "Acordarse or recordar?",
      body: "This pair trips up everyone. Want another go at it?",
    },
    destination: "El ejercicio suelto de esa palabra",
    optIn: "practice_due",
    status: "needsWork",
    note: "Los eventos de práctica guardan la sesión; hay que comprobar que el fallo por palabra viaja en metadata.",
  },
  {
    id: "arc_closure",
    priority: 8,
    group: "continuidad",
    label: "Cierre de arco",
    signal: "Una de las tres historias del tema hecha y arcType con final abierto, 3 días sin volver",
    window: "Una vez por tema",
    copy: {
      title: "That argument has an ending",
      body: "The third story finishes what started at the bar.",
    },
    destination: "La historia que cierra el arco",
    optIn: "new_content",
    status: "ready",
  },
  {
    id: "smart_streak",
    priority: 9,
    group: "continuidad",
    label: "Racha en riesgo, pero de verdad",
    signal: "Racha de 3 días o más y ninguna sesión hoy, medido a su hora habitual",
    window: "Como mucho una vez al día",
    copy: {
      title: "Six days in a row",
      body: "One short story tonight and it keeps going.",
    },
    destination: "La historia más corta pendiente de su nivel",
    optIn: "streak_risk",
    status: "ready",
    note: "El tipo ya existe y se agenda en el móvil; lo que falta es que solo salga cuando hay racha que perder.",
  },
  {
    id: "learned_hour",
    priority: 10,
    group: "continuidad",
    label: "Hora aprendida",
    signal: "Mediana de la hora de sus sesiones de las últimas 4 semanas",
    window: "No manda nada; reprograma los demás",
    copy: {
      title: "(no manda mensaje propio)",
      body: "Mueve la hora por defecto de los tipos locales a la hora en la que ese alumno abre la app.",
    },
    destination: "No aplica",
    optIn: "daily_reminder",
    status: "ready",
    note: "El 19:00 fijo de hourDefault es una media de nadie. UserMetric.createdAt tiene la hora real.",
  },
  {
    id: "new_variant_content",
    priority: 11,
    group: "descubrimiento",
    label: "Contenido nuevo de SU variante",
    signal: "Un journey pasa a active en el idioma y la variante que estudia",
    window: "Solo cuando se publica algo",
    copy: {
      title: "Colombia just opened",
      body: "Seven new topics at your level, coffee included.",
    },
    destination: "La portada del journey nuevo",
    optIn: "new_content",
    status: "ready",
    note: "El filtro por variante ya existe en la pestaña Journey; aquí se reusa tal cual.",
  },
  {
    id: "audio_landed",
    priority: 12,
    group: "descubrimiento",
    label: "Ya hay audio",
    signal: "Un journey que leyó sin narración pasa a tener audio publicado",
    window: "Una vez por journey",
    copy: {
      title: "Lyon has a voice now",
      body: "The stories you read can be listened to.",
    },
    destination: "La historia que mejor valoró de ese journey",
    optIn: "new_content",
    status: "needsWork",
    note: "Falta saber CUÁNDO aterrizó el audio: JourneyStory guarda audioUrl pero no la fecha en que se llenó.",
  },
  {
    id: "top_rated",
    priority: 13,
    group: "descubrimiento",
    label: "Lo mejor valorado de tu nivel",
    signal: "StoryRating alto esta semana en su idioma y nivel, en una historia que no ha abierto",
    window: "Como mucho una vez por semana",
    copy: {
      title: "This one is a favourite",
      body: "Six minutes, and the ending is worth it.",
    },
    destination: "Esa historia",
    optIn: "new_content",
    status: "ready",
  },
  {
    id: "winback_series",
    priority: 14,
    group: "vuelta",
    label: "Vuelta en tres tiempos",
    signal: "Sin ningún evento durante 7, 14 y 30 días",
    window: "Tres avisos y se calla",
    copy: {
      title: "The neighbours are still arguing",
      body: "Six minutes at your level, whenever you feel like it.",
    },
    destination: "Una historia concreta, nunca la pantalla de inicio",
    optIn: "daily_reminder",
    status: "ready",
    note: "La regla dura: cada aviso nombra una historia. Un mensaje genérico de vuelta no funciona.",
  },
  {
    id: "activation_d2",
    priority: 15,
    group: "vuelta",
    label: "Activación del segundo día",
    signal: "Cuenta creada y ninguna historia completada 48 horas después",
    window: "Una sola vez en la vida de la cuenta",
    copy: {
      title: "The short one is four minutes",
      body: "Just enough for your first story in Spanish.",
    },
    destination: "La historia más corta de su primer journey",
    optIn: "daily_reminder",
    status: "ready",
  },
  {
    id: "milestone",
    priority: 16,
    group: "memoria",
    label: "Hito personal",
    signal: "Diez historias completadas, cincuenta palabras guardadas o el primer journey terminado",
    window: "Una vez por hito",
    copy: {
      title: "50 words saved",
      body: "Three of them are ready for a quick round.",
    },
    destination: "La lista de palabras sin repasar",
    optIn: "practice_due",
    status: "ready",
    note: "Celebrar solo no basta; el hito abre la puerta a la acción siguiente.",
  },
  {
    id: "stale_collection",
    priority: 17,
    group: "memoria",
    label: "Colección abandonada",
    signal: "FavoriteCollection sin repaso en 10 días con 5 palabras o más",
    window: "Como mucho una vez cada 3 semanas por colección",
    copy: {
      title: "Your Kitchen list",
      body: "Twelve words in there, five minutes to see them all.",
    },
    destination: "Esa colección",
    optIn: "practice_due",
    status: "ready",
  },
];

export type CopyVoiceRule = { keep: string; avoid: string };

/**
 * Cómo suena un aviso. La prueba: léelo en voz alta como si lo dijera un amigo
 * que ha leído la misma historia. Si suena a que le pasas cuenta al alumno por
 * lo que no hizo, está mal escrito, aunque el dato sea correcto.
 */
export const PLAN_COPY_VOICE: CopyVoiceRule[] = [
  {
    keep: "Habla de la historia, la palabra o el personaje",
    avoid: "Habla de lo que el alumno dejó a medias o falló",
  },
  {
    keep: "\"El mercado is still open\"",
    avoid: "\"You stopped halfway\"",
  },
  {
    keep: "Curiosidad: una pregunta abierta, un cabo suelto",
    avoid: "Deber: cuenta atrás, racha que se rompe, deuda pendiente",
  },
  {
    keep: "Tú, sin regaño: \"want another go?\"",
    avoid: "Tú, señalando: \"you missed this one on Tuesday\"",
  },
  {
    keep: "Un detalle concreto del contenido, que solo el suyo tiene",
    avoid: "Fórmulas de app: \"pick up where you left off\", \"do not lose your progress\"",
  },
  {
    keep: "Un solo verbo en imperativo como mucho, y suave",
    avoid: "Órdenes apiladas: \"Open it. Finish it. Keep your streak.\"",
  },
];

export type PlanRule = { label: string; value: string };

/** Reglas que valen para TODOS los disparadores de arriba. */
export const PLAN_RULES: PlanRule[] = [
  { label: "Tope", value: "3 push por semana y usuario; nunca dos del mismo tipo en 72 horas" },
  { label: "Silencio", value: "De 22:00 a 08:00 locales el aviso se retrasa, no se descarta" },
  { label: "Prioridad", value: "Si dos caen el mismo día, gana el de número más bajo de esta tabla" },
  { label: "Opt-in", value: "Todo se filtra por notificationPrefs y se mapea a los 4 tipos existentes" },
  { label: "Una vez", value: "Cada envío deja una fila en UserMetric, como hace el puente hoy" },
  { label: "Medición", value: "push_opened con el id del disparador; se ve en la pestaña Efectividad" },
  { label: "Destino", value: "Ningún aviso abre la pantalla de inicio; siempre una historia, palabra o set" },
  { label: "Voz", value: "Teasea, no reprocha: el aviso habla del contenido, nunca de lo que el alumno dejó a medias" },
];

/** Lo que hoy limita la entrega, y no es un fallo. */
export const PLAN_CAVEAT =
  "Solo salen a iOS. Los tokens de Android se guardan con provider native y el proyecto no tiene emisor FCM, así que cualquier disparador nuevo deja fuera a los alumnos de Android hasta que exista.";

export function planCounts(items: SmartNotification[] = SMART_NOTIFICATIONS) {
  return {
    live: items.filter((n) => n.status === "live").length,
    ready: items.filter((n) => n.status === "ready").length,
    needsWork: items.filter((n) => n.status === "needsWork").length,
    total: items.length,
  };
}
