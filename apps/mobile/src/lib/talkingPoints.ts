/**
 * Talking Points en la app: catálogo por HTTP y adaptador al lector.
 *
 * La sección NO tiene pantalla propia de lectura. Se reutiliza
 * `ReaderScreen.tsx` tal cual, que ya trae karaoke, lookup por palabra y panel
 * de vocabulario, y lo único que hace falta es presentarle una pieza con la
 * forma que espera (`Book` + `Story`). Tres encajes que salen gratis:
 *
 *  - `story.slug` = slug de la pieza. El lector pide
 *    `/api/mobile/tap-glosses?slug=…` y los bundles `talking-points-es|de.json`
 *    ya están registrados en `src/lib/tapGlosses.ts`, así que el lookup de cada
 *    palabra funciona sin tocar nada.
 *  - `audioWordTimings` viaja como `cachedWordTimingsRaw`, la vía que el lector
 *    usa para el karaoke offline. Sin pedir nada a `/audio-word-timings`.
 *  - El vocabulario de la pieza se mapea a `VocabItem`, que es lo que alimenta
 *    las píldoras y el panel.
 *
 * SIN SECUENCIA a propósito: no hay anterior/siguiente. Se navega por
 * categorías y se entra donde uno quiera, que es lo contrario a un journey.
 */
import { apiFetch } from "./api";
import type { Book, Story, VocabItem } from "@digital-polyglot/domain";

export type TalkingIndexEntry = {
  topicSlug: string;
  topicLabel: string;
  country: string;
  language: string;
  slug: string;
  title: string;
  hook: string;
  angle: "explainer" | "debate" | "portrait";
  written: boolean;
  hasAudio: boolean;
  photoUrl: string | null;
};

export type TalkingCategoryRow = {
  id: string;
  label: string;
  entries: TalkingIndexEntry[];
};

export type TalkingSource = {
  id: string;
  org: string;
  title: string;
  url: string;
  supports: string;
  checkedAt: string;
  needsVerification?: boolean;
};

export type TalkingPieceFull = {
  slug: string;
  title: string;
  hook: string;
  angle: string;
  body: string[];
  vocab: Array<{
    term: string;
    surface?: string;
    type: string;
    register?: string;
    en: string;
  }>;
  sources: TalkingSource[];
  audioUrl: string | null;
  audioWordTimings: unknown | null;
  photo: { url?: string } | null;
};

export type TalkingTopicMeta = {
  slug: string;
  label: string;
  categoryId: string;
  country: string;
  language: string;
  level: string;
};

/** Lanzado cuando el plan del usuario no incluye la sección. */
export class TalkingPointsPlanError extends Error {
  constructor() {
    super("Talking Points is part of the Polyglot plan");
    this.name = "TalkingPointsPlanError";
  }
}

async function get<T>(baseUrl: string, token: string, path: string): Promise<T> {
  try {
    return await apiFetch<T>({ baseUrl, path, method: "GET", token, timeoutMs: 15000 });
  } catch (err) {
    // El endpoint responde 403 con code PLAN_REQUIRED cuando el plan no llega.
    // Se distingue del 404 a propósito, para poder ofrecer la mejora en vez de
    // enseñar un error mudo.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("403") || msg.includes("PLAN_REQUIRED")) {
      throw new TalkingPointsPlanError();
    }
    throw err;
  }
}

export async function fetchTalkingIndex(
  baseUrl: string,
  token: string
): Promise<TalkingCategoryRow[]> {
  const data = await get<{ categories?: TalkingCategoryRow[] }>(
    baseUrl,
    token,
    "/api/mobile/talking-points"
  );
  return Array.isArray(data?.categories) ? data.categories : [];
}

export async function fetchTalkingPiece(
  baseUrl: string,
  token: string,
  slug: string
): Promise<{ topic: TalkingTopicMeta; piece: TalkingPieceFull }> {
  return get(baseUrl, token, `/api/mobile/talking-points?slug=${encodeURIComponent(slug)}`);
}

/**
 * Convierte una pieza en el par `{ book, story }` que consume `ReaderScreen`.
 *
 * `book` es sintético: el lector lo usa para idioma, variante y para etiquetar
 * eventos. No hay libro real detrás, y no se inventa uno en la base.
 */
export function talkingPieceToReader(
  topic: TalkingTopicMeta,
  piece: TalkingPieceFull
): { book: Book; story: Story; cachedWordTimingsRaw: string | null } {
  const vocab: VocabItem[] = piece.vocab.map((v) => ({
    word: v.term,
    surface: v.surface,
    definition: v.en,
    type: v.type,
    register: v.register,
  }));

  const book = {
    id: `talking-${topic.slug}`,
    slug: `talking-${topic.slug}`,
    title: topic.label,
    description: "",
    language: topic.language,
    level: "advanced",
    cefrLevel: topic.level,
    topic: topic.label,
    stories: [],
  } as unknown as Book;

  const story = {
    id: `talking-${piece.slug}`,
    // El slug REAL de la pieza: es la clave con la que el lector pide los
    // glosses, y los bundles están indexados por ella.
    slug: piece.slug,
    title: piece.title,
    // Los párrafos se unen con doble salto, que es como el lector separa.
    text: piece.body.join("\n\n"),
    audio: piece.audioUrl ?? "",
    vocab,
    language: topic.language,
    cefrLevel: topic.level,
    topic: topic.label,
    coverUrl: piece.photo?.url,
  } as unknown as Story;

  return {
    book,
    story,
    cachedWordTimingsRaw: piece.audioWordTimings
      ? JSON.stringify(piece.audioWordTimings)
      : null,
  };
}
