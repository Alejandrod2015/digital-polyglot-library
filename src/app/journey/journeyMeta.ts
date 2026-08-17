// Datos mínimos de un journey para construir la metadata de la página y la
// imagen social. Deliberadamente NO reusa `loadJourneyPageProps`: aquel
// depende del usuario que mira (sus idiomas, su progreso, su variante
// preferida) y hace redirects, y la metadata tiene que ser la misma para
// todo el mundo, que es justo lo que se comparte.

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  buildJourneySlugMap,
  JOURNEY_STATUS_WHERE,
  STORY_STATUS_WHERE,
} from "./journeyData";
import { formatLanguageCode } from "@domain/displayFormat";
import { formatVariantLabel } from "@/lib/languageVariant";

/**
 * Consulta propia y ESTRECHA, a propósito.
 *
 * Reusar `getAllStudioJourneys` era lo obvio, pero ese loader trae las
 * historias enteras (texto incluido): 5,17 MB, por encima del límite de 2 MB
 * del data cache de Next, así que su `unstable_cache` nunca llega a guardar y
 * cada llamada lanza un rechazo no capturado. Es un problema que ya existe en
 * la página, y colgar la metadata del mismo loader lo habría triplicado por
 * visita (página + metadata + imagen).
 *
 * Aquí solo hacen falta los campos con los que se arma el slug y el recuento
 * de temas, que caben de sobra en la caché.
 */
const getJourneysForShareMeta = unstable_cache(
  async () => {
    return prisma.journey.findMany({
      where: { ...JOURNEY_STATUS_WHERE },
      orderBy: [{ language: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        language: true,
        variant: true,
        levels: true,
        stories: {
          where: { ...STORY_STATUS_WHERE, NOT: [{ text: null }, { title: null }] },
          select: { topic: true },
        },
      },
    });
  },
  ["journey-share-meta-v1"],
  { revalidate: 300, tags: ["published-journey-stories"] }
);

export type JourneyShareMeta = {
  slug: string;
  name: string;
  language: string;
  languageCode: string;
  variantLabel: string;
  level: string;
  topicCount: number;
  storyCount: number;
};

/**
 * Resuelve el `?variant=` a un journey publicado. Acepta las mismas tres
 * formas que la página (slug limpio, cuid legacy y código de variante) para
 * que un enlace viejo siga anunciando el journey correcto.
 *
 * Devuelve null cuando no resuelve; quien llama cae a la metadata genérica.
 */
export async function getJourneyShareMeta(
  variant: string | undefined
): Promise<JourneyShareMeta | null> {
  const incoming = typeof variant === "string" && variant.trim() ? variant.trim() : null;
  if (!incoming) return null;

  const journeys = await getJourneysForShareMeta();
  if (journeys.length === 0) return null;

  const slugById = buildJourneySlugMap(journeys);
  const lower = incoming.toLowerCase();

  const match =
    journeys.find((j) => slugById.get(j.id) === incoming) ??
    journeys.find((j) => j.id === incoming) ??
    journeys.find((j) => (j.variant ?? "").toLowerCase() === lower) ??
    null;
  if (!match) return null;

  const slug = slugById.get(match.id);
  // Sin slug = journey sin historias publicadas. No se anuncia.
  if (!slug) return null;

  const level = ((match.levels ?? [])[0] ?? "").toString().toUpperCase();
  const topics = new Set(
    (match.stories ?? [])
      .map((story) => (story.topic ?? "").trim().toLowerCase())
      .filter((topic) => topic.length > 0)
  );

  return {
    slug,
    name: (match.name ?? "").trim() || "Journey",
    // `Journey.language` viene en minúscula de Studio ("german"), y aquí es
    // texto que lee una persona en la previsualización del enlace.
    language: titleCase((match.language ?? "").trim()),
    languageCode: formatLanguageCode(match.language ?? "") ?? "",
    variantLabel: formatVariantLabel((match.variant ?? "").trim().toLowerCase()) ?? "",
    level,
    topicCount: topics.size,
    storyCount: (match.stories ?? []).length,
  };
}

/**
 * Origen absoluto del sitio, para `metadataBase`.
 *
 * Hace falta de verdad: sin `metadataBase`, Next resuelve las URLs relativas de
 * `openGraph.images` contra `http://localhost:3000`, así que la imagen social
 * saldría publicada apuntando a localhost y ninguna red social podría cargarla.
 * Misma convención que `src/lib/email.ts` para no inventar otra variable.
 */
export function siteOrigin(): URL {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://digitalpolyglot.com";
  try {
    return new URL(raw);
  } catch {
    return new URL("https://digitalpolyglot.com");
  }
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Título social: "Expat: German C1" (sin sufijo de marca; lo añade el layout). */
export function journeyShareTitle(meta: JourneyShareMeta): string {
  const tail = [meta.language, meta.level].filter(Boolean).join(" ");
  return tail ? `${meta.name}: ${tail}` : meta.name;
}

/**
 * Descripción social con los números reales del journey. Sin adjetivos de
 * marketing: lo que engancha aquí es el contenido concreto.
 */
export function journeyShareDescription(meta: JourneyShareMeta): string {
  const place = meta.variantLabel ? ` in ${meta.variantLabel}` : "";
  const topics = `${meta.topicCount} ${meta.topicCount === 1 ? "topic" : "topics"}`;
  const stories = `${meta.storyCount} ${meta.storyCount === 1 ? "story" : "stories"}`;
  return `${topics}, ${stories} of ${meta.language}${place}, read and heard at ${meta.level}.`;
}
