import { prisma } from "@/lib/prisma";
import {
  getCreateStoryMirrorBySlugFresh,
  getCreateStoryMirrorByStoryIdFresh,
  getDraftCreateStoryMirrorBySlug,
  getDraftCreateStoryMirrorByStoryId,
} from "@/lib/userStories";
import Player from "@/components/Player";
import { notFound, redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import AddStoryToLibraryButton from "@/components/AddStoryToLibraryButton";
import StoryContent from "@/components/StoryContent";
import StoryReaderShell from "@/components/StoryReaderShell";
import HighlightedStoryReader from "@/components/HighlightedStoryReader";
import { coerceAudioWordTimings } from "@/lib/audioWordTimingsTypes";
import { STORY_STATUS_WHERE } from "@/app/journey/journeyData";
import { checkKaraokeUsable } from "@/lib/karaokeQualityGate";
import { extractStoryPlainText } from "@/lib/storyPlainText";
import TapGlossReader from "@/components/TapGlossReader";
import TapGlossLayer from "@/components/TapGlossLayer";
import TapGlossText from "@/components/TapGlossText";
import { getTapGlossesForSlug } from "@/lib/tapGlosses";
import EndOfStoryPracticePrompt from "@/components/EndOfStoryPracticePrompt";
import JourneyStoryReadTracker from "@/components/JourneyStoryReadTracker";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import { getJourneyStoryBySlug } from "@/lib/journeyStories";
import { getStandaloneStoryAudioSegments } from "@/lib/standaloneStoryAudioSegments";
import {
  isSanityAssetUrl,
  resolvePublicMediaUrl,
  shouldBypassImageOptimization,
} from "@/lib/publicMedia";
import { canAccessStoryContent } from "@domain/access";
import StoryClientGate from "@/app/books/[bookSlug]/[storySlug]/StoryClientGate";
import { getLockedStoryPreviewHtml } from "@domain/lockedStoryPreview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    returnTo?: string;
    returnLabel?: string;
    from?: string;
  }>;
};

type SafeVocabItem = { word: string; surface?: string; definition: string; type?: string; register?: string };
type StorySource = "polyglot" | "standalone";
type StoryPayload = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab: unknown;
  audioUrl: string | null;
  audioStatus: string | null;
  language: string | null;
  region: string | null;
  level: string | null;
  coverUrl: string | null;
  source: StorySource;
  /** True when the story comes from the Journey content table
   *  (getJourneyStoryBySlug). Used to hide UI that doesn't belong in
   *  the curated journey path (e.g. the "save to library" bookmark -
   *  the journey IS the library). */
  isJourney: boolean;
  audioSegments: unknown;
};

function normalizePolyglotVocab(raw: unknown): SafeVocabItem[] {
  const coerce = (input: unknown): SafeVocabItem[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const word = typeof record.word === "string" ? record.word.trim() : "";
          const surface = typeof record.surface === "string" ? record.surface.trim() : "";
          const definition = typeof record.definition === "string" ? record.definition.trim() : "";
          const type = typeof record.type === "string" ? record.type.trim() : "";
          const register = typeof record.register === "string" ? record.register.trim() : "";
          if (!word || !definition) return null;
          return {
            word,
            ...(surface ? { surface } : {}),
            definition,
            ...(type ? { type } : {}),
            ...(register ? { register } : {}),
          };
        })
        .filter((item): item is SafeVocabItem => item !== null);
    }
    if (typeof input === "string") {
      try {
        return coerce(JSON.parse(input) as unknown);
      } catch {
        return [];
      }
    }
    return [];
  };
  return coerce(raw);
}

function normalizePolyglotStoryText(input: string): string {
  if (!input) return input;

  const hasHtml = /<[^>]+>/.test(input);
  if (!hasHtml) {
    return input
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => !/^[.?!,:;'"“”„«»\-–-]+$/.test(line))
      .join("\n\n");
  }

  return input
    .replace(/<p>\s*[.?!,:;'"“”„«»\-–-]+\s*<\/p>/gi, "")
    .replace(/<blockquote>\s*<p>\s*[.?!,:;'"“”„«»\-–-]+\s*<\/p>/gi, "<blockquote>")
    .replace(/<p>\s*[.?!,:;'"“”„«»\-–-]+\s*<\/p>\s*<blockquote/gi, "<blockquote")
    .replace(/<\/blockquote>\s*<p>\s*[.?!,:;'"“”„«»\-–-]+\s*<\/p>/gi, "</blockquote>")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJourneyReturnContext(returnTo?: string | null): {
  levelId: string;
  topicId: string;
  variant?: string;
} | null {
  if (typeof returnTo !== "string" || !returnTo.startsWith("/journey/")) return null;

  try {
    const url = new URL(returnTo, "https://example.local");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 3 || parts[0] !== "journey") return null;

    const levelId = parts[1]?.trim();
    const topicId = parts[2]?.trim();
    if (!levelId || !topicId) return null;

    const variant = url.searchParams.get("variant")?.trim() || undefined;
    return { levelId, topicId, variant };
  } catch {
    return null;
  }
}

async function getStoryPagePayload(slug: string): Promise<StoryPayload | null> {
  const polyglotStory = await prisma.userStory.findUnique({
    where: { slug },
  });
  const polyglotStoryMirror =
    (polyglotStory ? await getCreateStoryMirrorByStoryIdFresh(polyglotStory.id) : null) ??
    (await getCreateStoryMirrorBySlugFresh(slug));

  if (polyglotStory && polyglotStoryMirror?.slug && polyglotStoryMirror.slug !== slug) {
    return {
      id: polyglotStory.id,
      slug: polyglotStoryMirror.slug,
      title: polyglotStoryMirror.title,
      text: polyglotStoryMirror.text ?? polyglotStory.text,
      vocab: polyglotStoryMirror.vocabRaw ?? polyglotStory.vocab,
      audioUrl: polyglotStoryMirror.audioUrl ?? polyglotStory.audioUrl,
      audioStatus: polyglotStory.audioStatus,
      language: polyglotStoryMirror.language ?? polyglotStory.language,
      region: polyglotStoryMirror.region ?? polyglotStory.region,
      level: polyglotStoryMirror.level ?? polyglotStory.level,
      coverUrl: polyglotStoryMirror.coverUrl ?? polyglotStory.coverUrl,
      source: "polyglot",
      isJourney: false,
      audioSegments: polyglotStory.audioSegments,
    };
  }

  if (polyglotStory) {
    return {
      id: polyglotStory.id,
      slug: polyglotStory.slug,
      title: polyglotStoryMirror?.title ?? polyglotStory.title,
      text: polyglotStoryMirror?.text ?? polyglotStory.text,
      vocab: polyglotStoryMirror?.vocabRaw ?? polyglotStory.vocab,
      audioUrl: polyglotStoryMirror?.audioUrl ?? polyglotStory.audioUrl,
      audioStatus: polyglotStory.audioStatus,
      language: polyglotStoryMirror?.language ?? polyglotStory.language,
      region: polyglotStoryMirror?.region ?? polyglotStory.region,
      level: polyglotStoryMirror?.level ?? polyglotStory.level,
      coverUrl: polyglotStoryMirror?.coverUrl ?? polyglotStory.coverUrl,
      source: "polyglot",
      isJourney: false,
      audioSegments: polyglotStory.audioSegments,
    };
  }

  if (polyglotStoryMirror) {
    return {
      id: polyglotStoryMirror.createStoryId,
      slug: polyglotStoryMirror.slug,
      title: polyglotStoryMirror.title,
      text: polyglotStoryMirror.text ?? "",
      vocab: polyglotStoryMirror.vocabRaw,
      audioUrl: polyglotStoryMirror.audioUrl,
      audioStatus: null,
      language: polyglotStoryMirror.language,
      region: polyglotStoryMirror.region,
      level: polyglotStoryMirror.level,
      coverUrl: polyglotStoryMirror.coverUrl,
      source: "polyglot",
      isJourney: false,
      audioSegments: null,
    };
  }

  // Check journey stories (PostgreSQL) first
  const journeyStory = await getJourneyStoryBySlug(slug);
  if (journeyStory) {
    return {
      id: journeyStory.id,
      slug: journeyStory.slug,
      title: journeyStory.title,
      text: journeyStory.text,
      vocab: journeyStory.vocabRaw,
      audioUrl: journeyStory.audioUrl,
      audioStatus: null,
      language: journeyStory.language,
      region: journeyStory.region,
      level: journeyStory.level,
      coverUrl: journeyStory.coverUrl,
      source: "standalone",
      isJourney: true,
      audioSegments: null,
    };
  }

  // Fall back to Sanity standalone stories
  const standaloneStory = await getStandaloneStoryBySlug(slug);
  if (!standaloneStory) return null;

  return {
    id: standaloneStory.id,
    slug: standaloneStory.slug,
    title: standaloneStory.title,
    text: standaloneStory.text,
    vocab: standaloneStory.vocabRaw,
    audioUrl: standaloneStory.audioUrl,
    audioStatus: null,
    language: standaloneStory.language,
    region: standaloneStory.region,
    level: standaloneStory.level,
    coverUrl: standaloneStory.coverUrl,
    source: "standalone",
    isJourney: false,
    audioSegments: getStandaloneStoryAudioSegments(standaloneStory.slug),
  };
}

export default async function StoryPage({ params, searchParams }: StoryPageProps) {
  const { slug } = await params;
  const { returnTo, returnLabel, from } = await searchParams;

  const story = await getStoryPagePayload(slug);
  if (!story) {
    notFound();
  }

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";
  const isLocalhost =
    host.startsWith("localhost:") || host.startsWith("127.0.0.1:");

  let resolvedStory = story;
  if (isLocalhost && story.source === "polyglot") {
    const draftMirror =
      (story.id ? await getDraftCreateStoryMirrorByStoryId(story.id) : null) ??
      (await getDraftCreateStoryMirrorBySlug(slug));

    if (draftMirror) {
      resolvedStory = {
        ...story,
        slug: draftMirror.slug || story.slug,
        title: draftMirror.title || story.title,
        text: draftMirror.text ?? story.text,
        vocab: draftMirror.vocabRaw ?? story.vocab,
        audioUrl: draftMirror.audioUrl ?? story.audioUrl,
        language: draftMirror.language ?? story.language,
        region: draftMirror.region ?? story.region,
        level: draftMirror.level ?? story.level,
        coverUrl: draftMirror.coverUrl ?? story.coverUrl,
      };
    }
  }

  if (resolvedStory.slug !== slug) {
    redirect(`/stories/${resolvedStory.slug}`);
  }

  // OPT-IN word-level highlight payload. Only journey stories that have been
  // explicitly aligned via /api/studio/audio/word-timings get this populated.
  // Every other story stays on the existing StoryContent path untouched.
  // El filtro es el MISMO que deja abrir la historia (`STORY_STATUS_WHERE`), no
  // un `status: "published"` propio. Con el propio, un journey en obra se leía
  // en localhost pero SIN karaoke: la página renderizaba por la lista de
  // preview y esta consulta devolvía null, así que las marcas alineadas no
  // llegaban nunca al lector. En producción el filtro sigue siendo
  // published-only, que es lo que era antes.
  const journeyStoryRow = await prisma.journeyStory
    .findFirst({
      where: { slug, ...STORY_STATUS_WHERE },
      select: { audioWordTimings: true },
    })
    .catch(() => null);
  const audioWordTimings = journeyStoryRow?.audioWordTimings ?? null;
  // Un karaoke seguro de sí mismo pero equivocado es peor que ninguno: el
  // portón deja fuera las historias cuyo texto no corresponde al audio.
  const karaokeGate = checkKaraokeUsable(
    slug,
    coerceAudioWordTimings(audioWordTimings),
    story?.text ? extractStoryPlainText(story.text) : null
  );
  const hasWordTimings = karaokeGate.usable;

  const { userId } = await auth();
  const [user, featured] = await Promise.all([
    userId ? currentUser() : Promise.resolve(null),
    getFeaturedStories(),
  ]);
  const plan =
    (user?.publicMetadata?.plan as
      | "free"
      | "basic"
      | "premium"
      | "polyglot"
      | "owner") || "free";

  const isWeeklyStory = featured.week?.slug === resolvedStory.slug;
  const isDailyStory = featured.day?.slug === resolvedStory.slug;

  const hasFullAccess = canAccessStoryContent({
    plan,
    isWeeklyStory,
    isDailyStory,
  });

  const displayText = resolvedStory.text;
  const normalizedText = normalizePolyglotStoryText(displayText);
  // Piloto tap-any-word: las glosas viven en la base (dp_tap_glosses_v1) desde
  // el 2026-08-26; antes se importaban de src/data y viajaban en el build.
  const tapGlosses = await getTapGlossesForSlug(resolvedStory.slug);
  const lockedPreviewHtml = getLockedStoryPreviewHtml(resolvedStory.text);
  const safeVocab = normalizePolyglotVocab(resolvedStory.vocab);
  const fallbackReturnHref =
    resolvedStory.source === "polyglot" ? "/explore/polyglot-stories" : "/explore/stories";
  const resolvedReturnHref =
    typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : fallbackReturnHref;
  const resolvedReturnLabel =
    typeof returnLabel === "string" && returnLabel.trim()
      ? returnLabel.trim()
      : from === "my-library"
        ? "Back to My Library"
        : "More stories";
  const journeyContext = parseJourneyReturnContext(resolvedReturnHref);
  const currentStorySearch = new URLSearchParams();
  if (resolvedReturnHref) currentStorySearch.set("returnTo", resolvedReturnHref);
  if (resolvedReturnLabel) currentStorySearch.set("returnLabel", resolvedReturnLabel);
  if (typeof from === "string" && from.trim()) currentStorySearch.set("from", from.trim());
  const currentStoryHref = `/stories/${resolvedStory.slug}${currentStorySearch.toString() ? `?${currentStorySearch.toString()}` : ""}`;
  const practiceParams = new URLSearchParams(
    journeyContext
      ? {
          source: "journey",
          levelId: journeyContext.levelId,
          topicId: journeyContext.topicId,
        }
      : {
          source: "story",
          storySlug: resolvedStory.slug,
          storyTitle: resolvedStory.title,
          storyHref: currentStoryHref,
        }
  );
  if (journeyContext?.variant) practiceParams.set("variant", journeyContext.variant);
  if (resolvedReturnHref) practiceParams.set("returnTo", resolvedReturnHref);
  if (resolvedReturnLabel) practiceParams.set("returnLabel", resolvedReturnLabel);
  const practiceHref = `/practice?${practiceParams.toString()}`;

  const resolvedStoryCover =
    typeof resolvedStory.coverUrl === "string" && resolvedStory.coverUrl.trim() !== ""
      ? resolvePublicMediaUrl(resolvedStory.coverUrl) ?? resolvedStory.coverUrl
      : null;
  const storyCoverUrl =
    resolvedStoryCover && isSanityAssetUrl(resolvedStoryCover)
      ? `${resolvedStoryCover}?auto=format`
      : resolvedStoryCover;
  const storyCoverBlurUrl = resolvedStoryCover && isSanityAssetUrl(resolvedStoryCover)
    ? `${resolvedStoryCover}?w=160&blur=40&auto=format`
    : storyCoverUrl;
  const coverUrl = resolvePublicMediaUrl(resolvedStory.coverUrl) ?? "/covers/default.png";
  const unoptimizedStoryCover = shouldBypassImageOptimization(storyCoverUrl);
  const unoptimizedStoryCoverBlur = shouldBypassImageOptimization(storyCoverBlurUrl);
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(`/stories/${resolvedStory.slug}`)}`;

  if (typeof resolvedStory.coverUrl !== "string") {
  console.warn(`[story-page] Missing coverUrl for ${resolvedStory.slug}`);
}

  // El chrome del lector (contenedor, título, badges, portada, dock y
  // VocabPanel) vive en StoryReaderShell, compartido con Talking Points, para
  // que exista UN solo lector. Lo que sigue aquí es lo que de verdad cambia
  // por ruta: el gate de acceso y el cuerpo.
  return (
    <StoryReaderShell
      title={
        /* El título también entra en el diccionario. Se condiciona a que la
           capa esté montada abajo (glosses + acceso), porque sin ella los
           spans no tendrían quien los escuche. */
        tapGlosses && hasFullAccess ? (
          <TapGlossText text={resolvedStory.title} glosses={tapGlosses} />
        ) : (
          resolvedStory.title
        )
      }
      level={resolvedStory.level ?? undefined}
      language={resolvedStory.language ?? undefined}
      region={resolvedStory.region ?? undefined}
      cover={
        storyCoverUrl
          ? {
              url: storyCoverUrl,
              blurUrl: storyCoverBlurUrl,
              alt: resolvedStory.title,
              unoptimized: unoptimizedStoryCover,
              unoptimizedBlur: unoptimizedStoryCoverBlur,
            }
          : null
      }
      headerSlot={
        /* Botón de guardar en la biblioteca.
         *  OCULTO en historias de journey. El journey YA es la
         *  biblioteca curada del usuario; "save" no aplica. Sigue
         *  visible en standalone (Sanity) y create-story (polyglot). */
        !resolvedStory.isJourney ? (
          <div className="absolute top-[-2.75rem] right-6 z-30 sm:right-8">
            <AddStoryToLibraryButton
              storyId={resolvedStory.id}
              bookId={resolvedStory.source}
              title={resolvedStory.title}
              coverUrl={coverUrl}
              storySlug={resolvedStory.slug}
              bookSlug={resolvedStory.source}
              language={resolvedStory.language ?? undefined}
              region={resolvedStory.region ?? undefined}
              level={resolvedStory.level ?? undefined}
              audioUrl={resolvedStory.audioUrl ?? null}
              redirectHref={`/stories/${resolvedStory.slug}`}
              variant="icon"
            />
          </div>
        ) : null
      }
      dock={
        <>
          {/* Player fijo al fondo */}
          {resolvedStory.audioUrl ? (
            <div
              id="story-player-dock"
              className="fixed bottom-0 left-0 right-0 z-50 bg-transparent"
            >
              <Player
                src={resolvedStory.audioUrl}
                bookSlug={resolvedStory.source}
                storySlug={resolvedStory.slug}
                canPlay={hasFullAccess}
              />
            </div>
          ) : null}

          {!resolvedStory.audioUrl &&
          resolvedStory.source === "polyglot" &&
          resolvedStory.audioStatus !== "failed" ? (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#081a31] px-4 py-3 text-center text-sm text-blue-100/85 backdrop-blur">
              Audio is still being prepared. You can start reading now.
            </div>
          ) : null}

          {!resolvedStory.audioUrl &&
          resolvedStory.source === "polyglot" &&
          resolvedStory.audioStatus === "failed" ? (
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-400/20 bg-[#2b1d10] px-4 py-3 text-center text-sm text-amber-100 backdrop-blur">
              This story is ready to read, but audio is currently unavailable.
            </div>
          ) : null}
        </>
      }
      vocabPanel={{
        id: resolvedStory.id,
        slug: resolvedStory.slug,
        title: resolvedStory.title,
        language: resolvedStory.language ?? undefined,
        vocab: safeVocab,
        // La capa de contexto de la historia es la MISMA que usa el diccionario.
        // Las curadas son la capa que la historia sí quiere enseñar, así que no
        // pueden dar menos gramática que un toque cualquiera.
        glosses: tapGlosses ?? undefined,
      }}
    >
      {/* Texto principal */}
      <StoryClientGate
        plan={plan}
        storyId={resolvedStory.id}
        forceAllow={hasFullAccess}
        fallback={
          <div className="relative z-20 -mt-10 pt-4 pb-10 flex flex-col items-center text-center">
            <p className="text-[var(--foreground)] text-xl sm:text-xl mb-3">
              Unlock every story and master the real language inside.
            </p>
            <div className="flex items-center gap-3">
              {!userId ? (
                <a
                  href={signInHref}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-medium font-medium rounded-xl shadow-lg transition"
                >
                  Sign in
                </a>
              ) : null}
              <a
                href="/plans"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-medium font-medium rounded-xl shadow-lg transition"
              >
                Upgrade
              </a>
            </div>
          </div>
        }
      >
        {hasFullAccess ? (
          <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
            {hasWordTimings ? (
              <>
                <HighlightedStoryReader
                  story={{ vocab: safeVocab }}
                  audioWordTimings={audioWordTimings}
                />
                {/* Diccionario tap-any-word también en modo karaoke: los
                    spans [data-word-index] del karaoke sirven de target,
                    la capa solo aporta listener + burbuja. */}
                {tapGlosses ? (
                  <TapGlossLayer
                    glosses={tapGlosses}
                    story={{
                      slug: resolvedStory.slug,
                      title: resolvedStory.title,
                      language: resolvedStory.language,
                    }}
                  />
                ) : null}
              </>
            ) : tapGlosses ? (
              <TapGlossReader
                text={normalizedText}
                vocab={safeVocab}
                glosses={tapGlosses}
                story={{
                  slug: resolvedStory.slug,
                  title: resolvedStory.title,
                  language: resolvedStory.language,
                }}
              />
            ) : (
              <StoryContent
                text={normalizedText}
                sentencesPerParagraph={3}
                vocab={safeVocab}
              />
            )}
            {journeyContext ? (
              <JourneyStoryReadTracker
                storySlug={resolvedStory.slug}
                progressKey={`standalone:${resolvedStory.slug}`}
                levelId={journeyContext.levelId}
                topicId={journeyContext.topicId}
                variantId={journeyContext.variant}
              />
            ) : null}
            {/* iPhone parity: "Lock it in" prompt rises into view once
                the user scrolls past the end of the body. Vocab count
                feeds the headline ("Practice 12 words"). */}
            {/* practiceHref, no el que arma el propio aviso: éste lleva el
                `returnTo` de dónde venía el lector, y sin él la historia a la
                que se vuelve desde práctica no sabe adónde ir hacia atrás. */}
            <EndOfStoryPracticePrompt
              storySlug={resolvedStory.slug}
              storyTitle={resolvedStory.title}
              vocabCount={safeVocab.length}
              practiceHref={practiceHref}
            />
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6"
            dangerouslySetInnerHTML={{ __html: lockedPreviewHtml }}
          />
        )}
      </StoryClientGate>
    </StoryReaderShell>
  );
}
