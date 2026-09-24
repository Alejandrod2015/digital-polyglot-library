// Beta triage engine. Scores one application the moment it arrives and says
// what to do with it: invite now, park for review, or decline.
//
// The design intent is that you only ever look at the middle bucket. Anything
// clearly good goes straight to TestFlight; anything clearly not a fit gets a
// polite decline; the ambiguous ones queue up for a human. Every threshold
// lives in StudioConfig so tuning the funnel never needs a deploy.
//
// This module is PURE: its only import is the variant-pool table from the
// domain package, which is itself a plain map. Acting on a verdict (inviting,
// emailing, granting a plan) is betaProgram.ts's job, and loading the config
// is betaRulesConfig.ts's, so the scoring can be run from a script or a test
// without a database anywhere near it.
import { variantPool } from "@domain/languageVariant";
import { broadLevelFromCefr, normalizeBroadLevel } from "@domain/cefr";

export type BetaRulesConfig = {
  /** Score at or above this is invited without a human ever seeing it. */
  autoAcceptAt: number;
  /** Score below this is declined without a human ever seeing it. */
  autoDeclineBelow: number;
  /**
   * Ceiling on testers holding a live invite. Reaching it does not decline
   * anyone; it parks good applicants on the waitlist so the program grows at
   * a pace you can actually read the feedback from.
   */
  maxActiveTesters: number;
  /**
   * How the recruiting list is decided. "auto" derives it from the languages
   * that have at least one published journey, so shipping a language opens its
   * door on its own; "manual" freezes `acceptedTargetLanguages` as typed.
   *
   * Auto is the default because the manual list is the kind of field nobody
   * remembers to edit: it read ["Spanish","German"] on 2026-08-20 while
   * Portuguese, Italian and Spanish journeys were all live, and six Portuguese
   * applicants sat in the queue told we were "not recruiting Portuguese".
   */
  acceptedLanguagesMode: "auto" | "manual";
  /**
   * Target languages the beta is currently recruiting for. In auto mode this
   * is REPLACED at read time by the derived list (see betaRulesConfig.ts) and
   * the stored value is kept only as the fallback for switching to manual.
   */
  acceptedTargetLanguages: string[];
  /**
   * Content pools (`variantPool`, e.g. "portuguese-brazil") with at least one
   * published journey. Derived alongside the language list in auto mode. An
   * applicant whose language is accepted but whose variant resolves to a pool
   * missing from here is treated like an unrecruited language: nothing to hand
   * them. Empty means "no variant restriction", which is what manual mode and
   * config rows written before this field existed get.
   *
   * WHY (2026-09-22): the language gate passed a Portugal applicant with the
   * full 20 points while the only Portuguese journey live was Brazil. The
   * variant was collected at signup and used to filter the reader, never to
   * decide whether there was anything to invite the person to.
   */
  acceptedVariantPools: string[];
  /**
   * Bandas de nivel (beginner / intermediate / advanced) publicadas, por
   * variante exacta y por pool. Derivadas junto a las dos listas de arriba.
   *
   * Sin esto, pedir un nivel que no existe salia gratis: una profesora de
   * espanol de Espana que pedia avanzado cobraba los 37 puntos enteros de
   * disponibilidad el 2026-09-24, y no hay ningun C1 de Espana publicado.
   * El catalogo de Espana llega a B2 y ahi se acaba.
   *
   * Vacio significa "sin restriccion de nivel", que es lo que reciben el modo
   * manual y las filas escritas antes de que el campo existiera.
   */
  acceptedLevelsByVariant: Record<string, string[]>;
  /** Lo mismo por pool: un journey de Latam sirve a quien pidio Mexico. */
  acceptedLevelsByPool: Record<string, string[]>;
  /** Master switch. Off = every application queues, nothing is auto-invited. */
  autoInviteEnabled: boolean;

  // ── Program calendar. These drive the lifecycle cron, and every one of them
  // is null until you deliberately set it, so no end-of-beta email can fire
  // because a default date drifted past. ──

  /** ISO date the beta closes. Set it and the final survey schedules itself. */
  betaEndsAt: string | null;
  /** ISO date the app went live. Gates the review ask; null means never send. */
  launchedAt: string | null;
  /** Deep link to the App Store review sheet, used by the review ask. */
  appStoreReviewUrl: string | null;
  /** Days after the invite with no sign-in before the install nudge goes out. */
  installNudgeAfterDays: number;
  /** Days after a tester starts before the single-question feedback ask. */
  feedbackAskAfterDays: number;
  /** Days after a tester starts before the halfway survey. */
  midSurveyAfterDays: number;

  // ── Puertas de uso. Los días solos no dicen nada: el 2026-09-05 cuatro
  // testers llevaban 23 días dentro con cero historias, y otra había terminado
  // siete en su primer día. Lo que decide si alguien tiene algo que contar es
  // lo que ha hecho, y los días de arriba pasan a ser sólo un suelo para que
  // una petición no caiga el mismo día que entra. ──

  /** Historias terminadas que abre la primera petición. */
  feedbackAskMinStories: number;
  /** Ejercicios completados que abren la primera petición. */
  feedbackAskMinExercises: number;
  /** Historias terminadas que abren la encuesta de mitad. */
  midSurveyMinStories: number;
  /** Ejercicios completados que abren la encuesta de mitad. */
  midSurveyMinExercises: number;
  /**
   * Días dentro sin terminar una sola historia antes de preguntar qué les
   * frenó. No es una encuesta: son las personas de las que no sabemos nada, y
   * su respuesta vale más que un NPS de quien ya está enganchado.
   */
  stuckAskAfterDays: number;
  /** Days before betaEndsAt that the final survey goes out. */
  finalSurveyBeforeEndDays: number;
  /**
   * Final-survey score at or above which a tester is asked for a review.
   * Below it they get the recovery email instead, which asks what was missing
   * and never mentions the App Store.
   */
  reviewAskMinRating: number;
};

export const DEFAULT_BETA_RULES: BetaRulesConfig = {
  // 100 y 11, recalibrados el 2026-09-24 con el reparto nuevo de senales.
  // Primero fueron 73 y 29 (los viejos 60 y 24 llevados a la escala
  // normalizada), pero pasar 17 puntos del texto libre a la disponibilidad
  // sube a todo el que pide algo publicado: la mediana de los 150 solicitantes
  // con score paso de 48 a 78. 88 es el mismo percentil 86 que ocupaba el 60
  // viejo, y 33 el mismo percentil 3 que ocupaba el 24. Quien entraba
  // directo sigue entrando directo; quien se rechazaba sin leer, igual.
  // (88 en el primer reparto; 90 al pasar 10 puntos de las horas declaradas
  // a la motivacion; 94 y 26 al sacar las horas y la cuenta de tienda; 100 y
  // 11 al salir tambien la motivacion.)
  //
  // Con dos senales el score solo puede tomar NUEVE valores, asi que el
  // umbral de arriba acaba en el propio maximo: auto-aceptar significa ahora
  // "su nivel esta publicado en su variante exacta y escribio algo". Es una
  // consecuencia del reparto, no un descuido; el auto-invite lleva apagado
  // desde antes, y si se enciende hay que mirar esto primero.
  autoAcceptAt: 100,
  // Bajado de 30 el 2026-08-23, el día que "How did you hear about us?" salió
  // del formulario: aportaba entre 4 y 10 puntos a todo el mundo, 6 de mediana,
  // y sin él el mismo solicitante puntúa 6 menos. Dejar el piso en 30 habría
  // rechazado sin leerlo a quien ayer entraba a revisión.
  autoDeclineBelow: 11,
  maxActiveTesters: 100,
  acceptedLanguagesMode: "auto",
  acceptedTargetLanguages: ["Spanish", "German", "Italian", "French", "Portuguese"],
  acceptedVariantPools: [],
  acceptedLevelsByVariant: {},
  acceptedLevelsByPool: {},
  autoInviteEnabled: true,
  betaEndsAt: null,
  launchedAt: null,
  appStoreReviewUrl: null,
  installNudgeAfterDays: 3,
  // Suelos, no calendario: la puerta de verdad son las dos líneas de abajo.
  feedbackAskAfterDays: 2,
  midSurveyAfterDays: 7,
  feedbackAskMinStories: 1,
  feedbackAskMinExercises: 1,
  midSurveyMinStories: 3,
  midSurveyMinExercises: 2,
  stuckAskAfterDays: 7,
  finalSurveyBeforeEndDays: 5,
  reviewAskMinRating: 8,
};

// Throwaway-inbox domains. Not exhaustive by design: this catches the lazy
// case, and a determined signup with a real-looking address is exactly the
// kind of ambiguity the review queue exists for.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "spamgourmet.com",
]);

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

// Phrases that show up verbatim in applications written to get past a form
// rather than to say something. Matched on the lowercased reason.
const LOW_EFFORT_MARKERS = [
  "i want to test",
  "i want to try",
  "sounds good",
  "sounds interesting",
  "looks cool",
  "looks interesting",
  "nice app",
  "good app",
  "let me in",
  "please accept",
  "i like languages",
  "i love languages",
  "test the app",
  "want to be a beta tester",
];

export type BetaApplication = {
  email: string;
  appleIdEmail?: string | null;
  /** Google account the Android tester joins the testers group with. */
  googleEmail?: string | null;
  platform?: string | null;
  hasIPhone: boolean;
  targetLanguage: string;
  /** Variant slug from the form ("portugal", "latam"); null on old rows. */
  targetVariant?: string | null;
  nativeLanguage: string;
  currentLevel: string;
  weeklyHours?: string | null;
  motivation?: string | null;
  applicationReason?: string | null;
};

export type BetaDecision = "auto_accept" | "queue" | "auto_decline";

export type BetaVerdict = {
  decision: BetaDecision;
  score: number;
  /** One line you can read in the Studio without opening the application. */
  reason: string;
  /** Every signal that moved the score, for the "why did it decide that" panel. */
  signals: Array<{ label: string; points: number }>;
};

/**
 * Mide el texto libre de "por que quieres entrar", y mide poco a proposito.
 *
 * Valia 27 de los 82 puntos porque se daba por hecho que quien escribe dos
 * frases concretas prueba la app y quien escribe "i want to test" la instala
 * una vez. Con 124 invitados y aceptados ya se puede comprobar, y no es
 * cierto: la correlacion entre palabras escritas y actividad real es 0,01, y
 * con el feedback enviado es -0,04. Los dos testers mas activos de todo el
 * programa escribieron 7 y 5 palabras; el que escribio 115 esta el decimo.
 *
 * Asi que aqui solo queda el suelo: distinguir a quien contesto de verdad de
 * quien no contesto. Diez puntos, y las restas son por las senales de
 * respuesta tirada, no por brevedad. Nadie tiene tiempo de escribir un parrafo
 * y eso nunca fue lo que separaba a un tester bueno de uno ausente.
 */
function scoreApplicationReason(reason: string | null | undefined): {
  points: number;
  note: string;
} {
  const text = (reason ?? "").trim();
  if (!text) return { points: 0, note: "no reason given" };

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  // Contesto: parte arriba y solo baja por las senales de respuesta tirada.
  let points = REASON_MAX;

  // Menos de ocho palabras no es una respuesta corta, es un campo rellenado.
  // Resta, pero no deja en cero: "Interested what it has to offer" dice menos
  // que "I just moved to Las Vegas" y las dos dicen algo.
  if (words.length < 8) points -= 5;

  // Las frases hechas del que solo quiere la invitacion, cuando ademas no hay
  // texto alrededor que las respalde.
  if (LOW_EFFORT_MARKERS.some((m) => lower.includes(m)) && words.length < 25) points -= 5;

  // Ni una mayuscula ni un signo: tecleado para pasar el validador.
  if (text === lower && !/[.!?,]/.test(text)) points -= 2;

  // La misma palabra una y otra vez es relleno para llegar al minimo.
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  if (words.length >= 12 && unique / words.length < 0.5) points -= 3;

  const clamped = Math.max(0, Math.min(REASON_MAX, points));
  const note =
    clamped >= REASON_MAX ? "answered properly"
    : clamped >= 5 ? "short answer"
    : "low-effort answer";
  return { points: clamped, note };
}

/**
 * El techo que la suma de senales puede alcanzar de verdad, senal por senal.
 *
 * Cada constante es el maximo REAL de su senal, no un tope teorico: si una
 * deja de ser alcanzable, esta suma miente y el `/100` vuelve a mentir con
 * ella. Quedan dos senales y la suma da 47; cada vez que sale una el techo
 * baja, y los umbrales se recalibran al percentil que ocupaban en vez de
 * quedarse donde estaban.
 *
 * Existe porque el score se presenta como `/100` y nadie podia pasar de 82:
 * un 43 se leia como suspenso cuando era el 52% de lo alcanzable, y eso hacia
 * parecer descartado a quien pedia justo lo que tenemos publicado.
 */
const REASON_MAX = 10;
const LANGUAGE_MAX = 37;
/**
 * Lo que vale que el nivel pedido exista en el POOL pero no en la variante
 * exacta: un journey de Latam le sirve a quien pidio Mexico, y no igual de
 * bien que uno mexicano. Es el 70% de la nota entera, redondeado.
 */
const LANGUAGE_POOL_MATCH = 26;
const MAX_RAW_SCORE = REASON_MAX + LANGUAGE_MAX;

/** La suma cruda, llevada a la escala 0..100 que dice la interfaz. */
function normalizeScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round((raw / MAX_RAW_SCORE) * 100)));
}

/*
 * Aqui vivian tres senales que ya no se puntuan (2026-09-24, decision del
 * usuario):
 *
 * - La MOTIVACION del desplegable, que llego a valer 22. Fuera porque el
 *   programa necesita gente DISTINTA probando: puntuar el motivo convierte al
 *   scorer en un filtro de perfil y las plazas se irian todas al mismo tipo
 *   de aprendiz. Que "Family connection" rinda mas que "Just for fun" en la
 *   mediana no es razon para dejar de invitar a quien aprende por gusto.
 *
 * - Las HORAS POR SEMANA, que costaron 20 puntos y luego 10. Ordenaban al
 *   reves: entre los 124 invitados y aceptados, quien declaro 1-3 horas tiene
 *   mediana de 5,5 eventos y quien declaro 4-7 tiene 4. Es una promesa sobre
 *   el futuro hecha en un formulario, y se comporta como tal.
 * - La CUENTA DE TIENDA distinta del correo de contacto, que valia 3 por
 *   "leyo el campo en vez de pegar lo mismo dos veces". Mide atencion al
 *   rellenar, no ganas de usar la app.
 *
 * Las dos columnas se siguen recogiendo y se siguen viendo en la ficha del
 * Studio; lo que no hacen es mover el numero.
 */

/**
 * Decides what happens to one application.
 *
 * Hard gates run first and short-circuit the score: no amount of enthusiasm
 * makes an applicant without an iPhone testable on an iOS-only beta.
 */
export function evaluateApplication(
  app: BetaApplication,
  rules: BetaRulesConfig,
  context: { activeTesterCount: number },
): BetaVerdict {
  const signals: Array<{ label: string; points: number }> = [];

  // ── Hard gates ──
  const platform = (app.platform ?? "ios").toLowerCase();
  const wantsIos = platform === "ios" || platform === "both";
  const wantsAndroid = platform === "android" || platform === "both";

  if (DISPOSABLE_DOMAINS.has(emailDomain(app.email))) {
    return {
      decision: "auto_decline",
      score: 0,
      reason: "Disposable email domain",
      signals: [{ label: "Disposable email domain", points: 0 }],
    };
  }

  // Applied for iOS without an iPhone. Since Android joined the beta this is
  // no longer "the beta is iOS-only", it is a contradiction inside one
  // application, so it stays a decline: there is no device to test on.
  if (wantsIos && !wantsAndroid && !app.hasIPhone) {
    return {
      decision: "auto_decline",
      score: 0,
      reason: "Applied for the iOS beta without an iPhone",
      signals: [{ label: "No iPhone", points: 0 }],
    };
  }

  if (wantsIos && !app.appleIdEmail?.trim()) {
    // Without an Apple ID there is nothing to send the TestFlight invite to.
    // Queue rather than decline: it is a missing field, not a bad applicant.
    return {
      decision: "queue",
      score: 0,
      reason: "No Apple ID on file, so the invite has nowhere to go",
      signals: [{ label: "Missing Apple ID", points: 0 }],
    };
  }

  // The Android mirror of the Apple ID gate, and it bites harder. Play grants
  // access by Google Group membership, so the tester link is useless unless we
  // know which Google account is supposed to join. Queue, same as above: a
  // missing field is a question to ask, not a reason to turn someone away.
  if (wantsAndroid && !wantsIos && !app.googleEmail?.trim()) {
    return {
      decision: "queue",
      score: 0,
      reason: "No Google account on file, so there is nobody to let into the testers group",
      signals: [{ label: "Missing Google account", points: 0 }],
    };
  }

  // ── Score ──
  const reason = scoreApplicationReason(app.applicationReason);
  signals.push({ label: `Application text: ${reason.note}`, points: reason.points });

  const languageRecruited = rules.acceptedTargetLanguages.some(
    (l) => l.toLowerCase() === app.targetLanguage.trim().toLowerCase(),
  );
  // A variant we model (Portugal, Quebec) counts only if a journey in its pool
  // is live. One we do not ("other", a free-typed country, an old null row)
  // cannot be held against the applicant, so it falls through to the language.
  const pool = variantPool(app.targetVariant);
  const normalizedVariant = (app.targetVariant ?? "").trim().toLowerCase() || null;
  const variantServed =
    !pool || rules.acceptedVariantPools.length === 0 || rules.acceptedVariantPools.includes(pool);
  const languageAccepted = languageRecruited && variantServed;
  // La banda que pide, y donde la tenemos publicada. El formulario escribe
  // "Beginner" / "Intermediate" / "Advanced"; los journeys guardan a0..c2, y
  // el config trae ya las bandas por variante y por pool.
  const banda = normalizeBroadLevel(app.currentLevel) ?? broadLevelFromCefr(app.currentLevel);
  const bandasVariante = rules.acceptedLevelsByVariant[normalizedVariant ?? ""] ?? [];
  const bandasPool = rules.acceptedLevelsByPool[pool ?? ""] ?? [];
  const sinMapaDeNiveles =
    Object.keys(rules.acceptedLevelsByVariant).length === 0 &&
    Object.keys(rules.acceptedLevelsByPool).length === 0;
  // Falla abierto por partida doble: sin mapa (modo manual, config vieja) y
  // sin banda reconocible, el nivel no se le puede echar en cara a nadie.
  const cobertura: "exacta" | "pool" | "ninguna" =
    !languageAccepted ? "ninguna"
    : sinMapaDeNiveles || !banda ? "exacta"
    : bandasVariante.includes(banda) ? "exacta"
    : bandasPool.includes(banda) ? "pool"
    : "ninguna";

  // 37, no 20. Los 17 que suben vienen del texto libre, que los cobraba sin
  // predecir nada. Que tengamos publicado lo que la persona pide es lo unico
  // que sabemos con certeza antes de invitarla, y por eso tiene que mirar las
  // tres cosas que decide: idioma, variante y NIVEL.
  const languagePoints =
    cobertura === "exacta" ? LANGUAGE_MAX : cobertura === "pool" ? LANGUAGE_POOL_MATCH : 0;
  const nivelServido = cobertura !== "ninguna";
  signals.push({
    label: !languageRecruited
      ? `Target language ${app.targetLanguage} is not being recruited for`
      : !variantServed
        ? `No published ${app.targetLanguage} journey for ${app.targetVariant} yet`
        : cobertura === "ninguna"
          ? `No ${banda} ${app.targetLanguage} journey for ${app.targetVariant} yet`
          : cobertura === "pool"
            ? `${banda} ${app.targetLanguage} is published, but not for ${app.targetVariant}`
            : `Target language ${app.targetLanguage} is in the beta`,
    points: languagePoints,
  });

  // Los puntos de cada senal siguen siendo los de siempre (y asi se listan en
  // `signals`); lo que sale de aqui es su porcentaje del techo alcanzable.
  const score = normalizeScore(reason.points + languagePoints);

  // ── Verdict ──
  // A la cola, nunca al rechazo: que hoy no tengamos su nivel no dice nada de
  // la persona, y publicar ese journey lo arregla solo. El score se recalcula
  // en cada lectura de la cola, asi que la ficha se corrige sola ese dia.
  if (!languageAccepted || !nivelServido) {
    return {
      decision: "queue",
      score,
      reason: !languageRecruited
        ? `Not recruiting ${app.targetLanguage} right now`
        : !variantServed
          ? `No ${app.targetLanguage} (${app.targetVariant}) journey published yet`
          : `No ${banda} ${app.targetLanguage} journey for ${app.targetVariant} published yet`,
      signals,
    };
  }

  if (score < rules.autoDeclineBelow) {
    return { decision: "auto_decline", score, reason: `Score ${score} is below the decline floor`, signals };
  }

  if (!rules.autoInviteEnabled) {
    return { decision: "queue", score, reason: "Auto-invite is switched off", signals };
  }

  if (context.activeTesterCount >= rules.maxActiveTesters) {
    return {
      decision: "queue",
      score,
      reason: `Waitlisted: ${context.activeTesterCount}/${rules.maxActiveTesters} tester slots are full`,
      signals,
    };
  }

  if (score >= rules.autoAcceptAt) {
    return { decision: "auto_accept", score, reason: `Score ${score} clears the bar`, signals };
  }

  return { decision: "queue", score, reason: `Score ${score} is in the review band`, signals };
}
