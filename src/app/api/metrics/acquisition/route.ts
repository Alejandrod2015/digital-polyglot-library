export const runtime = "nodejs";

import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInternalUserIds, isMetricsAccessAllowed } from "@/lib/metricsAccess";
import { getBetaUserIds, parseMetricsCohort } from "@/lib/metricsCohort";
import { resolveStoryLanguages } from "@/lib/storyLanguages";
import { buildRetention, SERVER_WRITTEN_METRIC_EVENTS } from "@/lib/metricsRetention";
import { pushTokenPlatform } from "@/lib/mobilePlatform";
import {
  Origin,
  appOrigin,
  classifyOrigin,
  decodeOrigin,
  firstTouchFromVisit,
} from "@/lib/signupSource";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// Source-of-truth signups come from Clerk (the user.created webhook that
// mirrors them into UserMetric is unreliable). This endpoint lists Clerk
// users, filters to the requested window, and cross-references the prod DB
// to build the real activation funnel:
//   signup -> onboarded -> opened a story -> actually listened -> viewed plans -> paid
// Everything is read-only.

type RecentSignup = {
  userId: string;
  name: string | null;
  /**
   * true cuando el nombre sale de la solicitud de beta y no de Clerk. Quien
   * se dio de alta con código por email o con Apple ocultando el nombre no
   * deja `firstName` en Clerk, así que la tabla lo pintaba como "-" teniendo
   * su nombre guardado en `BetaSignup`. Es dato suyo igual, sólo que de otro
   * formulario, y por eso se marca de dónde salió en vez de mezclarlo.
   */
  nameFromBeta: boolean;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  targetLanguages: string[];
  /** Declarado por la persona en el formulario de beta, si aplicó. */
  betaLanguages: string[];
  /**
   * Estado en el programa de beta (`BetaSignup.status`), o null si esta
   * persona nunca solicitó. Va SEPARADO de `betaLanguages`: aquél dice de
   * dónde salió el idioma que mostramos, éste dice quién es la persona.
   * Confundirlos escondía beta testers: quien completó el onboarding tiene
   * `targetLanguages`, así que nunca caía en la rama del idioma "de beta" y
   * la tabla lo pintaba igual que a un usuario cualquiera.
   */
  betaStatus: string | null;
  /** Deducido de las historias que abrió, cuando no hay nada declarado. */
  inferredLanguages: string[];
  level: string | null;
  onboarded: boolean;
  openedStory: boolean;
  /**
   * Total escuchado: suma, por historia, del punto más lejano alcanzado en
   * ella (las terminadas cuentan su duración completa). Antes era el máximo
   * de UNA sola historia, así que quien había recorrido veinticinco aparecía
   * igual que quien recorrió una.
   */
  listenedSeconds: number;
  /**
   * El progreso se graba a saltos (~20s), así que un valor que sale de un
   * checkpoint y no de una pausa o de un final es un suelo, no una medición.
   * true = al menos una historia aportó un valor de ese tipo.
   */
  listenedApprox: boolean;
  /** Cuántas historias aportan a `listenedSeconds`. */
  listenedStories: number;
  listened: boolean;
  completedStory: boolean;
  viewedPlans: boolean;
  paid: boolean;
  /**
   * Compró: redimió un claim de libro (la tienda) o tiene una suscripción
   * viva. Es el corte que separa, dentro de "público", a quien pagó de
   * quien solo se dio de alta. Un beta tester puede ser comprador también;
   * la cohorte manda y este distintivo solo describe.
   */
  bought: boolean;
  /**
   * Práctica. Van los tres campos crudos en vez de una cadena ya montada
   * porque "4/5 · 90%" y "no ha practicado nunca" no son la misma ausencia,
   * y quien pinta la tabla necesita poder distinguirlas.
   *
   * `practiceStarted` nunca es menor que `practiceCompleted`: la app móvil
   * manda el evento de fin de una práctica de historia sin el de inicio que
   * sí escribe la web, y el denominador se corrige al mayor de los dos.
   */
  practiceStarted: number;
  practiceCompleted: number;
  /** Media de `accuracyPercent` de las sesiones TERMINADAS. null si ninguna. */
  practiceAccuracy: number | null;
  platform: "ios" | "android" | "web" | null;
  /**
   * De donde vino esta cuenta. Nunca es null: la tabla tenia filas sin
   * ninguna etiqueta y no habia forma de saber si eran de un anuncio, de la
   * tienda o de una busqueda.
   *
   * `basis` dice cuanto vale la etiqueta y no se puede esconder:
   *  - "stamped": lo sello su propia visita (primer toque) o la app.
   *  - "probable": cruce por tiempo entre el alta y la UNICA sesion que paso
   *    por la pagina de alta en esos minutos. Se pinta en cursiva.
   *  - "unknown": cuenta anterior a que esto se midiera. No se adivina.
   */
  origin: { key: string; label: string; basis: "stamped" | "probable" | "unknown" };
  /**
   * Por que puerta entro esta persona al producto. Una sola, siempre, y
   * responde una unica pregunta: como llego a tener cuenta. No dice si paga
   * (eso es la columna Pago) ni si ha hecho algo (Onb. y Abrio), que era la
   * mezcla que dejaba filas enteras sin ninguna etiqueta.
   */
  userType: { key: "beta" | "audiolibro" | "app" | "web" | "unknown"; label: string };
};

/**
 * Primer evento llegado desde la app. Antes de esa fecha solo existia la
 * webapp, asi que una cuenta anterior sin sello ni actividad solo pudo nacer
 * navegando. Despues de esa fecha no se adivina: sale "s/d".
 */
const APP_ERA_START = Date.parse("2026-06-23T00:00:00Z");

const TEAM_DOMAINS = ["muvn.de"];
function isTeamEmail(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return (
    TEAM_DOMAINS.some((d) => e.endsWith("@" + d)) ||
    e.includes("+betatest") ||
    e.endsWith("@example.com")
  );
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { key: string; at: number; payload: unknown } | null = null;

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("days") ?? "30")));
  const metricsCohort = parseMetricsCohort(req.nextUrl.searchParams.get("cohort"));
  const cacheKey = `acq:${days}:${metricsCohort}`;
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload);
  }

  const now = Date.now();
  const windowStart = now - days * 86400000;
  const d7 = now - 7 * 86400000;
  const d30 = now - 30 * 86400000;

  try {
    const internalIds = new Set(await getInternalUserIds());

    // Paginate all Clerk users (instance is small pre-launch; cap at 2000).
    const total = await clerkClient.users.getCount();
    const all: Awaited<ReturnType<typeof clerkClient.users.getUserList>>["data"] = [];
    for (let offset = 0; offset < total && offset < 2000; offset += 100) {
      const page = await clerkClient.users.getUserList({ orderBy: "-created_at", limit: 100, offset });
      all.push(...page.data);
      if (page.data.length < 100) break;
    }

    const externalAll = all.filter((u) => {
      const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null;
      return !internalIds.has(u.id) && !isTeamEmail(email);
    });

    // La cohorte se aplica AQUI, sobre las cuentas de Clerk, para que las
    // altas, el embudo y la tabla hablen todos de la misma gente. Sin esto,
    // esta pestana seguiria mostrando a todo el mundo mientras la cabecera
    // dice "Beta".
    const betaIds = new Set(await getBetaUserIds());
    const external =
      metricsCohort === "all"
        ? externalAll
        : externalAll.filter((u) =>
            metricsCohort === "beta" ? betaIds.has(u.id) : !betaIds.has(u.id),
          );

    const totalExternal = external.length;
    const signupsLast7d = external.filter((u) => u.createdAt >= d7).length;
    const signupsLast30d = external.filter((u) => u.createdAt >= d30).length;

    // Cohort = users created within the requested window.
    const cohort = external.filter((u) => u.createdAt >= windowStart);
    const ids = cohort.map((u) => u.id);

    // ── DB cross-reference (single round of grouped queries) ──
    const [
      audioEvents,
      plansEvents,
      continueRows,
      entitlements,
      claimRows,
      activityRows,
      practiceRows,
    ] = await Promise.all([
      ids.length
        ? prisma.userMetric.findMany({
            where: { userId: { in: ids }, eventType: { in: ["story_opened", "audio_play", "audio_complete", "audio_pause", "continue_listening"] } },
            // storySlug is here for the inferred-language fallback below.
            select: { userId: true, eventType: true, storySlug: true, value: true, metadata: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.userMetric.findMany({
            where: { userId: { in: ids }, eventType: "plans_viewed" },
            select: { userId: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.continueListeningEntry.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, storySlug: true, progressSec: true },
          })
        : Promise.resolve([]),
      ids.length
        ? prisma.billingEntitlement.findMany({
            where: { userId: { in: ids }, status: "active" },
            select: { userId: true, plan: true },
          })
        : Promise.resolve([]),
      // Compradores de libros: el claim de la tienda es lo único que los
      // identifica, porque una compra en Shopify no deja entitlement.
      ids.length
        ? prisma.claimToken.findMany({
            where: { redeemedBy: { in: ids } },
            select: { redeemedBy: true },
          })
        : Promise.resolve([]),
      // Toda la actividad de esta gente, para la retencion por cohorte. No
      // lleva filtro de fecha a proposito: la cohorte ya esta acotada por su
      // alta, y lo que interesa es justo lo que hicieron DESPUES, incluso si
      // cae fuera de la ventana que se esta mirando.
      ids.length
        ? prisma.userMetric.findMany({
            where: {
              userId: { in: ids },
              eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS },
            },
            select: { userId: true, createdAt: true },
            take: 200000,
          })
        : Promise.resolve([]),
      // Practica: las dos mitades del mismo gesto. Empezar una sesion y
      // terminarla son eventos distintos a proposito, y la distancia entre
      // ambos es la mitad de lo que dice la columna: quien empieza cinco y
      // acaba dos no esta practicando, esta abandonando.
      ids.length
        ? prisma.userMetric.findMany({
            where: {
              userId: { in: ids },
              eventType: { in: ["practice_session_started", "practice_session_completed"] },
            },
            select: { userId: true, eventType: true, metadata: true },
            take: 100000,
          })
        : Promise.resolve([]),
    ]);

    // Exclude story_opened from the audio set; it's an "opened" signal, not
    // an actual listen.
    const audioBy = new Set(
      audioEvents.filter((e) => e.eventType !== "story_opened").map((e) => e.userId)
    );
    const completedBy = new Set(
      audioEvents.filter((e) => e.eventType === "audio_complete").map((e) => e.userId)
    );
    const storyOpenedBy = new Set(
      audioEvents.filter((e) => e.eventType === "story_opened").map((e) => e.userId)
    );
    const plansBy = new Set(plansEvents.map((e) => e.userId));
    // "Abrió" = explicit story_opened event (new, clean) ∪ legacy signals
    // (resume rows / any audio event) so historical cohorts keep the step now
    // that sub-floor resume rows are no longer written.
    const openedBy = new Set<string>([
      ...storyOpenedBy,
      ...continueRows.map((c) => c.userId),
      ...audioBy,
    ]);
    // ── Total escuchado ──
    // Por historia nos quedamos con el punto más lejano alcanzado en ella, y
    // luego SUMAMOS esos puntos. El máximo global de antes decía lo mismo de
    // quien había recorrido veinticinco historias que de quien recorrió una.
    // Sigue siendo posición, no tiempo de reloj: quien arrastra la barra hasta
    // el final cuenta el final. Es lo único que la instrumentación permite
    // afirmar, así que la tabla lo nombra como lo que es.
    //
    // `exact` distingue de dónde salió el número: una pausa (posición literal)
    // o el final de la historia son exactos; un checkpoint del reproductor no,
    // porque se graba a saltos de ~20s y por debajo del suelo no se graba nada.
    // El primer checkpoint cae siempre en 20s clavados, y ese 20 no significa
    // "escuchó veinte segundos" sino "al menos veinte".
    const MAX_PLAUSIBLE_SEC = 4 * 3600;
    type Reached = { sec: number; exact: boolean };
    const reachedBy = new Map<string, Map<string, Reached>>();
    const bumpStory = (
      userId: string,
      slug: string | null | undefined,
      seconds: number,
      exact: boolean
    ) => {
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_PLAUSIBLE_SEC) return;
      const perStory = reachedBy.get(userId) ?? new Map<string, Reached>();
      // Los eventos sin slug van todos al mismo cajón a propósito: sumarlos
      // como si fueran historias distintas inflaría el total con repeticiones
      // de la misma escucha.
      const key = slug ?? "(sin historia)";
      const prev = perStory.get(key);
      const rounded = Math.round(seconds);
      // En empate gana el exacto: la fila de "seguir escuchando" y el
      // `audio_pause` de la misma pausa traen el mismo segundo, y si el
      // checkpoint llega primero se quedaba con el asterisco una medición
      // que era literal.
      const wins = !prev || rounded > prev.sec || (rounded === prev.sec && exact && !prev.exact);
      if (wins) perStory.set(key, { sec: rounded, exact });
      reachedBy.set(userId, perStory);
    };
    for (const c of continueRows) bumpStory(c.userId, c.storySlug, c.progressSec ?? 0, false);
    for (const e of audioEvents) {
      const m = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>) : null;
      const fromMeta = typeof m?.progressSec === "number" ? m.progressSec : null;
      const fromValue = typeof e.value === "number" ? e.value : null;
      if (e.eventType === "audio_complete") {
        // `value` es la duración del audio, que es exactamente hasta dónde
        // llegó: terminar es el único caso en que la posición no se queda
        // corta. Los `audio_complete` duplicados de una misma historia no
        // suman dos veces porque el mapa es por slug.
        const durationSec = typeof m?.audioDurationSec === "number" ? m.audioDurationSec : fromValue;
        bumpStory(e.userId, e.storySlug, durationSec ?? 0, true);
        continue;
      }
      if (e.eventType === "audio_pause") {
        bumpStory(e.userId, e.storySlug, fromValue ?? fromMeta ?? 0, true);
        continue;
      }
      if (e.eventType === "continue_listening") {
        bumpStory(e.userId, e.storySlug, fromMeta ?? fromValue ?? 0, false);
      }
    }
    const listenedTotalFor = (userId: string): { seconds: number; approx: boolean; stories: number } => {
      const perStory = reachedBy.get(userId);
      if (!perStory || perStory.size === 0) return { seconds: 0, approx: false, stories: 0 };
      let seconds = 0;
      let approx = false;
      for (const r of perStory.values()) {
        seconds += r.sec;
        if (!r.exact) approx = true;
      }
      return { seconds, approx, stories: perStory.size };
    };
    const paidBy = new Set(
      entitlements.filter((e) => !(e.plan ?? "").toLowerCase().includes("free")).map((e) => e.userId)
    );
    const boughtBy = new Set<string>([
      ...claimRows.map((c) => c.redeemedBy).filter((id): id is string => Boolean(id)),
      ...paidBy,
    ]);

    // ── Platform split (iPhone app vs webapp) ──
    // Events are now stamped with metadata.platform at write time. For users
    // who were active before that, fall back to Clerk privateMetadata: anyone
    // with a registered mobile push token has the iOS app installed.
    const eventIos = new Set<string>();
    const eventAndroid = new Set<string>();
    const eventWeb = new Set<string>();
    for (const e of audioEvents) {
      const m = e.metadata && typeof e.metadata === "object" ? (e.metadata as Record<string, unknown>) : null;
      const pf = typeof m?.platform === "string" ? m.platform : null;
      // "android" ya no cae en el saco de iOS. Metía a los usuarios de Android
      // en la columna del iPhone, que es justo lo que la columna promete que no
      // pasa. "mobile" es el valor viejo y genérico: sin más información, esos
      // eventos son de la época en que la app sólo existía en iPhone.
      if (pf === "android") eventAndroid.add(e.userId);
      else if (pf === "ios" || pf === "mobile") eventIos.add(e.userId);
      else if (pf === "web") eventWeb.add(e.userId);
    }
    // El token de push SÍ dice el sistema: cada registro guarda el suyo. Antes
    // aquí sólo se preguntaba si existía alguno, y el respaldo de abajo daba
    // "ios" por sentado.
    const devicePlatform = (u: (typeof cohort)[number]) => pushTokenPlatform(u.privateMetadata);
    const platformFor = (u: (typeof cohort)[number]): "ios" | "android" | "web" | null => {
      // Authoritative: stamped at signup by the mobile session route (el
      // sistema que dice el propio cliente) and the web platform ping ("web").
      // Only legacy cohorts (created before stamping) fall through to
      // activity/push-token inference below.
      const sp = (u.publicMetadata as Record<string, unknown>)?.signupPlatform;
      if (sp === "ios" || sp === "android" || sp === "web") return sp;
      // Un evento "android" sólo lo escribe la cabecera del cliente, así que
      // es una afirmación. Un evento "ios" puede ser el valor por defecto de
      // la ruta cuando la cabecera no viene, así que NO puede ir por delante
      // del token de push, que sí sabe en qué teléfono se registró.
      if (eventAndroid.has(u.id)) return "android";
      const device = devicePlatform(u);
      if (device) return device;
      if (eventIos.has(u.id)) return "ios";
      if (eventWeb.has(u.id)) return "web";
      return null;
    };

    // ── Idioma deducido ──
    // `targetLanguages` sólo existe si terminaron el onboarding, así que quien
    // se saltó ese paso y se fue directo a leer aparecía sin idioma, aunque
    // hubiera escuchado veinte segundos de una historia cuyo idioma conocemos
    // perfectamente. No es un dato perdido, es una pregunta sin responder que
    // su propia actividad ya contesta. Se devuelve aparte de `targetLanguages`
    // para que la tabla pueda marcarlo como deducido y no como declarado.
    const slugsByUser = new Map<string, Set<string>>();
    const addSlug = (userId: string, slug: string | null | undefined) => {
      if (!slug) return;
      const set = slugsByUser.get(userId) ?? new Set<string>();
      set.add(slug);
      slugsByUser.set(userId, set);
    };
    for (const e of audioEvents) addSlug(e.userId, e.storySlug);
    for (const c of continueRows) addSlug(c.userId, c.storySlug);

    const languageBySlug = await resolveStoryLanguages(
      Array.from(new Set(Array.from(slugsByUser.values()).flatMap((s) => Array.from(s))))
    );

    const inferredFor = (userId: string): string[] => {
      const slugs = slugsByUser.get(userId);
      if (!slugs) return [];
      const langs = new Set<string>();
      for (const slug of slugs) {
        const lang = languageBySlug.get(slug);
        if (lang) langs.add(lang);
      }
      return Array.from(langs).sort();
    };

    // ── Idioma declarado en el formulario de beta ──
    // Un beta tester ya nos dijo qué idioma quiere y con qué nivel, en el
    // formulario, antes incluso de tener cuenta. Que la tabla mostrara "-"
    // para alguien de quien teníamos "Spanish · Beginner" guardado no era falta
    // de dato, era no ir a buscarlo. Va por delante de la deducción por
    // historias: esto lo declaró la persona, aquello lo suponemos nosotros.
    //
    // El cruce NO puede hacerse sólo por el email del formulario. En iOS el
    // acceso es por invitación individual a la tienda, así que quien solicita
    // deja DOS direcciones: la suya y la de su Apple ID o su cuenta de Google,
    // que en 14 de 39 solicitudes no son la misma. La cuenta de la app nace de
    // la segunda, así que buscar por la primera dejaba a beta testers
    // enteros sin nombre y sin idioma, como si no hubieran rellenado nada.
    // `clerkUserId`, cuando existe, es el vínculo fuerte y va primero.
    const emailsCohorte = cohort
      .flatMap((u) => (u.emailAddresses ?? []).map((e) => e.emailAddress?.toLowerCase()).filter(Boolean) as string[])
      .filter(Boolean);
    const betaRows = emailsCohorte.length
      ? await prisma.betaSignup.findMany({
          where: {
            OR: [
              { email: { in: emailsCohorte } },
              { appleIdEmail: { in: emailsCohorte, mode: "insensitive" } },
              { googleEmail: { in: emailsCohorte, mode: "insensitive" } },
              { clerkUserId: { in: ids } },
            ],
          },
          select: {
            email: true,
            appleIdEmail: true,
            googleEmail: true,
            clerkUserId: true,
            firstName: true,
            targetLanguage: true,
            currentLevel: true,
            status: true,
          },
        })
      : [];
    type BetaRow = (typeof betaRows)[number];
    const betaByEmail = new Map<string, BetaRow>();
    const betaByClerkId = new Map<string, BetaRow>();
    for (const r of betaRows) {
      if (r.clerkUserId) betaByClerkId.set(r.clerkUserId, r);
      // El email del formulario gana si dos filas comparten una dirección de
      // tienda: es el que la persona nos dio como suyo.
      for (const addr of [r.appleIdEmail, r.googleEmail]) {
        const key = addr?.trim().toLowerCase();
        if (key && !betaByEmail.has(key)) betaByEmail.set(key, r);
      }
      betaByEmail.set(r.email.toLowerCase(), r);
    }
    const betaFor = (u: (typeof cohort)[number]): BetaRow | undefined => {
      const byId = betaByClerkId.get(u.id);
      if (byId) return byId;
      for (const e of u.emailAddresses ?? []) {
        const hit = e.emailAddress ? betaByEmail.get(e.emailAddress.toLowerCase()) : undefined;
        if (hit) return hit;
      }
      return undefined;
    };

    // ── Practica por persona ──
    // `accuracyPercent` viene dentro del `metadata` de cada sesion terminada.
    // La media es de las sesiones terminadas y solo de esas: una sesion que
    // se abandona no deja nota, y contarla como cero diria que fallo cuando
    // lo que hizo fue irse.
    type PracticeAgg = { started: number; completed: number; accuracy: number | null };
    const practiceBy = new Map<string, PracticeAgg>();
    const accuracyByUser = new Map<string, number[]>();
    for (const row of practiceRows) {
      const agg = practiceBy.get(row.userId) ?? { started: 0, completed: 0, accuracy: null };
      if (row.eventType === "practice_session_started") agg.started += 1;
      else {
        agg.completed += 1;
        const meta =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null;
        if (typeof meta?.accuracyPercent === "number" && Number.isFinite(meta.accuracyPercent)) {
          const list = accuracyByUser.get(row.userId) ?? [];
          list.push(meta.accuracyPercent);
          accuracyByUser.set(row.userId, list);
        }
      }
      practiceBy.set(row.userId, agg);
    }
    for (const [userId, list] of accuracyByUser) {
      const agg = practiceBy.get(userId);
      if (agg && list.length) {
        agg.accuracy = Math.round(list.reduce((sum, v) => sum + v, 0) / list.length);
      }
    }
    // Terminar sin haber empezado pasa: la app movil manda el `completed` de
    // una practica de historia sin el `started` que la web si escribe. La
    // columna diria "2/0", asi que el denominador es el mayor de los dos.
    const practiceFor = (userId: string): PracticeAgg => {
      const agg = practiceBy.get(userId) ?? { started: 0, completed: 0, accuracy: null };
      return { ...agg, started: Math.max(agg.started, agg.completed) };
    };

    // ── Origen ──
    // La visita a la pagina de alta y la cuenta que nace de ella son el mismo
    // gesto separado por segundos, pero nada las une: la tabla de visitas no
    // sabe quien es nadie. Desde el sello de primer toque las cuentas nuevas
    // lo traen encima; para las anteriores se cruza por tiempo, y solo cuando
    // la respuesta es UNA. Si dos personas pasaron por la pagina de alta en
    // la misma ventana no hay atribucion posible, y entonces se dice "s/d"
    // en vez de elegir una de las dos.
    const MATCH_WINDOW_MS = 5 * 60 * 1000;
    const signupVisits = await prisma.pageVisit.findMany({
      where: {
        createdAt: { gte: new Date(windowStart - MATCH_WINDOW_MS) },
        path: { contains: "sign-up" },
      },
      select: { sessionId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    const visitSessions = Array.from(
      new Set(signupVisits.map((v) => v.sessionId).filter((x): x is string => Boolean(x))),
    );
    // Primera visita de cada sesion: el primer toque de esa persona, que es
    // lo que dice de donde vino. La ultima casi siempre es nuestra propia
    // pagina de alta, que no informa de nada.
    const firstVisitBySession = new Map<
      string,
      { utmSource: string | null; utmCampaign: string | null; referrer: string | null }
    >();
    if (visitSessions.length) {
      const rows = await prisma.pageVisit.findMany({
        where: { sessionId: { in: visitSessions } },
        select: { sessionId: true, utmSource: true, utmCampaign: true, referrer: true },
        orderBy: { createdAt: "asc" },
        take: 20000,
      });
      for (const r of rows) {
        if (r.sessionId && !firstVisitBySession.has(r.sessionId)) firstVisitBySession.set(r.sessionId, r);
      }
    }
    const probableOriginFor = (createdAt: number): Origin | null => {
      const hits = new Set<string>();
      for (const v of signupVisits) {
        if (!v.sessionId) continue;
        if (Math.abs(v.createdAt.getTime() - createdAt) <= MATCH_WINDOW_MS) hits.add(v.sessionId);
      }
      if (hits.size !== 1) return null;
      const first = firstVisitBySession.get(Array.from(hits)[0]);
      return first ? classifyOrigin(firstTouchFromVisit(first)) : null;
    };
    // Puerta de entrada. El orden importa y es el de la propia historia de
    // la persona: al programa se entra por invitacion, y quien esta dentro
    // llego por ahi aunque despues comprara un libro.
    const bookBy = new Set(
      claimRows.map((c) => c.redeemedBy).filter((id): id is string => Boolean(id)),
    );
    const userTypeFor = (u: (typeof cohort)[number]): RecentSignup["userType"] => {
      // Por id y tambien por sus tres direcciones: el tester cuyo webhook
      // nunca enlazo la cuenta sigue siendo tester, y por id solo salia como
      // usuario cualquiera.
      const betaStatus = betaFor(u)?.status;
      if (betaIds.has(u.id) || betaStatus === "invited" || betaStatus === "accepted") {
        return { key: "beta", label: "Beta" };
      }
      if (bookBy.has(u.id)) return { key: "audiolibro", label: "Audiolibro" };
      const pf = platformFor(u);
      if (pf === "ios" || pf === "android") return { key: "app", label: "App" };
      if (pf === "web") return { key: "web", label: "Web" };
      if (u.createdAt < APP_ERA_START) return { key: "web", label: "Web" };
      return { key: "unknown", label: "s/d" };
    };

    const originFor = (u: (typeof cohort)[number]): RecentSignup["origin"] => {
      const stamped = decodeOrigin((u.publicMetadata as Record<string, unknown>)?.signupSource);
      if (stamped) return { ...stamped, basis: "stamped" };
      const pf = platformFor(u);
      // Quien nacio en la app entro por una tienda. Es deduccion, no sello,
      // asi que va marcado como probable.
      if (pf === "ios" || pf === "android") return { ...appOrigin(pf), basis: "probable" };
      const probable = probableOriginFor(u.createdAt);
      if (probable) return { ...probable, basis: "probable" };
      return { key: "unknown", label: "s/d", basis: "unknown" };
    };

    const recent: RecentSignup[] = cohort
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => {
        const md = (u.publicMetadata ?? {}) as Record<string, unknown>;
        const tls = Array.isArray(md.targetLanguages) ? (md.targetLanguages as string[]) : [];
        const heard = listenedTotalFor(u.id);
        const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null;
        const beta = betaFor(u);
        const declaredLevel = typeof md.preferredLevel === "string" ? (md.preferredLevel as string) : null;
        const clerkName = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        const betaName = beta?.firstName?.trim() || null;
        const practice = practiceFor(u.id);
        return {
          userId: u.id,
          name: clerkName ?? betaName,
          nameFromBeta: !clerkName && Boolean(betaName),
          email,
          createdAt: new Date(u.createdAt).toISOString(),
          lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
          targetLanguages: tls,
          betaLanguages: tls.length || !beta?.targetLanguage ? [] : [beta.targetLanguage],
          betaStatus: beta?.status ?? null,
          inferredLanguages: tls.length || beta?.targetLanguage ? [] : inferredFor(u.id),
          level: declaredLevel ?? (tls.length ? null : beta?.currentLevel ?? null),
          onboarded: tls.length > 0,
          openedStory: openedBy.has(u.id),
          listenedSeconds: heard.seconds,
          listenedApprox: heard.approx,
          listenedStories: heard.stories,
          listened: audioBy.has(u.id) || heard.seconds > 0,
          completedStory: completedBy.has(u.id),
          viewedPlans: plansBy.has(u.id),
          paid: paidBy.has(u.id),
          bought: boughtBy.has(u.id),
          practiceStarted: practice.started,
          practiceCompleted: practice.completed,
          practiceAccuracy: practice.accuracy,
          platform: platformFor(u),
          origin: originFor(u),
          userType: userTypeFor(u),
        };
      });

    const C = cohort.length;
    const funnel = {
      signups: C,
      onboarded: recent.filter((r) => r.onboarded).length,
      openedStory: recent.filter((r) => r.openedStory).length,
      listened: recent.filter((r) => r.listened).length,
      viewedPlans: recent.filter((r) => r.viewedPlans).length,
      paid: recent.filter((r) => r.paid).length,
    };

    // ── Retencion por cohorte de alta ──
    // Las columnas se recortan a lo que el rango permite medir: pedir 30 dias
    // y pintar doce semanas seria ensenar diez columnas que solo pueden estar
    // vacias. `buckets` va sobre la ventana, no sobre la vida del usuario.
    //
    // Se calculan las dos granularidades de una vez y viajan juntas: el
    // panel alterna semanal/diario en el cliente, y volver a pedir esto por
    // un clic significaria listar Clerk entero otra vez.
    const retentionSignups = cohort.map((u) => ({
      userId: u.id,
      createdAt: new Date(u.createdAt),
    }));
    const retention = buildRetention({
      signups: retentionSignups,
      activity: activityRows,
      now: new Date(now),
      buckets: Math.ceil(days / 7),
    });
    const retentionDaily = buildRetention({
      signups: retentionSignups,
      activity: activityRows,
      now: new Date(now),
      buckets: days,
      bucketDays: 1,
    });

    // Quien es quien en la tabla de retencion. Las celdas viajan con ids, y
    // sin este diccionario un 33% no se puede leer como "volvio Fulano": la
    // lista de "Altas recientes" se corta en 50 y la cohorte puede ser mayor.
    const retentionUsers: Record<
      string,
      {
        name: string | null;
        email: string | null;
        /** Suma del punto más lejano alcanzado en cada historia, en la ventana entera. */
        listenedSeconds: number;
        listenedApprox: boolean;
        listenedStories: number;
        completedStory: boolean;
      }
    > = {};
    for (const r of recent) {
      retentionUsers[r.userId] = {
        name: r.name,
        email: r.email,
        listenedSeconds: r.listenedSeconds,
        listenedApprox: r.listenedApprox,
        listenedStories: r.listenedStories,
        completedStory: r.completedStory,
      };
    }

    const payload = {
      source: "clerk" as const,
      windowDays: days,
      retention,
      retentionDaily,
      retentionUsers,
      signups: {
        totalAllTime: totalExternal,
        last7d: signupsLast7d,
        last30d: signupsLast30d,
        inWindow: C,
        byPlatform: {
          ios: recent.filter((r) => r.platform === "ios").length,
          android: recent.filter((r) => r.platform === "android").length,
          web: recent.filter((r) => r.platform === "web").length,
          unknown: recent.filter((r) => r.platform === null).length,
        },
      },
      funnel,
      recent: recent.slice(0, 50),
      clerkInstance: (process.env.CLERK_SECRET_KEY ?? "").startsWith("sk_live_") ? "production" : "development",
    };

    cache = { key: cacheKey, at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("❌ /api/metrics/acquisition error:", err);
    return NextResponse.json(
      { error: "Failed to load acquisition data", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
