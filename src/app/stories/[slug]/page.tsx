import { prisma } from "@/lib/prisma";
import { getCreateStoryMirrorBySlug, getCreateStoryMirrorByStoryId } from "@/lib/userStories";
import Player from "@/components/Player";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import AddStoryToLibraryButton from "@/components/AddStoryToLibraryButton";
import ScrollToTopOnPathChange from "@/components/ScrollToTopOnPathChange";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import StoryContent from "@/components/StoryContent";
import VocabPanel from "@/components/VocabPanel";
import { getStandaloneStoryBySlug } from "@/lib/standaloneStories";
import { getStandaloneStoryAudioSegments } from "@/lib/standaloneStoryAudioSegments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StoryPageProps = {
  params: Promise<{ slug: string }>;
};

type SafeVocabItem = { word: string; definition: string; type?: string };
type StorySource = "polyglot" | "standalone";

function normalizePolyglotVocab(raw: unknown): SafeVocabItem[] {
  const coerce = (input: unknown): SafeVocabItem[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const word = typeof record.word === "string" ? record.word.trim() : "";
          const definition = typeof record.definition === "string" ? record.definition.trim() : "";
          const type = typeof record.type === "string" ? record.type.trim() : "";
          if (!word || !definition) return null;
          return { word, definition, ...(type ? { type } : {}) };
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
      .filter((line) => !/^[.?!,:;'"“”„«»\-–—]+$/.test(line))
      .join("\n\n");
  }

  return input
    .replace(/<p>\s*[.?!,:;'"“”„«»\-–—]+\s*<\/p>/gi, "")
    .replace(/<blockquote>\s*<p>\s*[.?!,:;'"“”„«»\-–—]+\s*<\/p>/gi, "<blockquote>")
    .replace(/<p>\s*[.?!,:;'"“”„«»\-–—]+\s*<\/p>\s*<blockquote/gi, "<blockquote")
    .replace(/<\/blockquote>\s*<p>\s*[.?!,:;'"“”„«»\-–—]+\s*<\/p>/gi, "</blockquote>")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;

  const polyglotStory = await prisma.userStory.findUnique({
    where: { slug },
  });
  const polyglotStoryMirror =
    (polyglotStory ? await getCreateStoryMirrorByStoryId(polyglotStory.id) : null) ??
    (await getCreateStoryMirrorBySlug(slug));

  if (polyglotStory && polyglotStoryMirror?.slug && polyglotStoryMirror.slug !== slug) {
    redirect(`/stories/${polyglotStoryMirror.slug}`);
  }

  const standaloneStory = polyglotStory || polyglotStoryMirror ? null : await getStandaloneStoryBySlug(slug);

  if (!polyglotStory && !polyglotStoryMirror && !standaloneStory) {
    notFound();
  }

  const source: StorySource = polyglotStory || polyglotStoryMirror ? "polyglot" : "standalone";
  const story = polyglotStory
    ? {
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
        source,
        audioSegments: polyglotStory.audioSegments,
      }
    : polyglotStoryMirror
      ? {
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
          source,
          audioSegments: null,
        }
    : {
        id: standaloneStory!.id,
        slug: standaloneStory!.slug,
        title: standaloneStory!.title,
        text: standaloneStory!.text,
        vocab: standaloneStory!.vocabRaw,
        audioUrl: standaloneStory!.audioUrl,
        audioStatus: null,
        language: standaloneStory!.language,
        region: standaloneStory!.region,
        level: standaloneStory!.level,
        coverUrl: standaloneStory!.coverUrl,
        source,
        audioSegments: getStandaloneStoryAudioSegments(standaloneStory!.slug),
      };

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

  const isWeeklyStory = featured.week?.slug === story.slug;
  const isDailyStory = featured.day?.slug === story.slug;

  const hasFullAccess =
    source === "standalone"
      ? true
      : plan === "premium" ||
        plan === "polyglot" ||
        plan === "owner" ||
        (plan === "basic" && (isWeeklyStory || isDailyStory)) ||
        (plan === "free" && isWeeklyStory);

  const displayText = hasFullAccess
    ? story.text
    : `${story.text.slice(0, 1000)}…`;
  const normalizedText = normalizePolyglotStoryText(displayText);
  const safeVocab = normalizePolyglotVocab(story.vocab);

  const storyCoverUrl =
    typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
      ? story.coverUrl.startsWith("https://cdn.sanity.io/")
        ? `${story.coverUrl}?auto=format`
        : story.coverUrl
      : null;
  const storyCoverBlurUrl = storyCoverUrl?.includes("cdn.sanity.io/")
    ? `${story.coverUrl}?w=160&blur=40&auto=format`
    : storyCoverUrl;
  const coverUrl = story.coverUrl ?? "/covers/default.png";
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(`/stories/${story.slug}`)}`;

  if (userId) {
    try {
      await prisma.libraryStory.upsert({
        where: {
          userId_storyId: {
            userId,
            storyId: story.id,
          },
        },
        update: {
          title: story.title,
          coverUrl,
          bookId: source,
        },
        create: {
          userId,
          storyId: story.id,
          title: story.title,
          coverUrl,
          bookId: source,
        },
      });
    } catch (err) {
      console.error("[stories/:slug] Failed to auto-save independent story", err);
    }
  }

  if (typeof story.coverUrl !== "string") {
  console.warn(`[story-page] Missing coverUrl for ${story.slug}`);
}

  return (
    <div className="relative max-w-5xl mx-auto pt-1 px-8 pb-[8rem] text-foreground">
      <ScrollToTopOnPathChange />
      {/* Botón de guardar en la biblioteca */}
      <div className="absolute top-[-2.75rem] right-6 z-30 sm:right-8">
        <AddStoryToLibraryButton
          storyId={story.id}
          bookId={source}
          title={story.title}
          coverUrl={coverUrl}
          storySlug={story.slug}
          bookSlug={source}
          language={story.language ?? undefined}
          region={story.region ?? undefined}
          level={story.level ?? undefined}
          audioUrl={story.audioUrl ?? null}
          redirectHref={`/stories/${story.slug}`}
          variant="icon"
        />
      </div>

      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-4xl font-bold text-[var(--foreground)] text-center">
          {story.title}
        </h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <LevelBadge level={story.level ?? undefined} />
          <LanguageBadge language={story.language ?? undefined} />
          <RegionBadge region={story.region ?? undefined} />
        </div>
      </div>

      {/* Cover de historia (solo si existe) */}
      {storyCoverUrl ? (
        <div className="mb-7">
          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#102746] md:h-[220px] lg:h-[240px]">
            <div className="relative w-full md:hidden aspect-[16/10]">
              <Image
                src={storyCoverUrl}
                alt={story.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 0px"
                className="object-contain"
              />
            </div>
            <div className="absolute inset-0 hidden md:block">
              <Image
                src={storyCoverBlurUrl ?? storyCoverUrl}
                alt=""
                aria-hidden="true"
                fill
                priority
                sizes="(max-width: 1024px) 896px, 960px"
                className="object-cover scale-110 blur-2xl opacity-65"
              />
            </div>
            <div
              className="absolute inset-0 hidden md:block"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--bg-content) 16%, transparent) 0%, color-mix(in srgb, var(--bg-content) 54%, transparent) 100%)",
              }}
            />
            <div className="relative z-10 hidden h-full w-full md:block">
              <Image
                src={storyCoverUrl}
                alt={story.title}
                fill
                priority
                sizes="(max-width: 1024px) 896px, 960px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Texto principal */}
      <div className="relative">
        {hasFullAccess ? (
          <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
            <StoryContent
              text={normalizedText}
              sentencesPerParagraph={3}
              vocab={safeVocab}
            />
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6"
            dangerouslySetInnerHTML={{ __html: normalizedText }}
          />
        )}

        {/* Fallback si no tiene acceso */}
        {!hasFullAccess && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-56 z-10"
              style={{
                background:
                  "linear-gradient(to top, var(--bg-content) 26%, color-mix(in srgb, var(--bg-content) 78%, transparent) 62%, transparent 100%)",
              }}
            />
            <div className="relative z-20 -mt-10 pt-4 pb-10 flex flex-col items-center text-center">
              <p className="text-[var(--foreground)] text-xl sm:text-xl mb-3">
                Unlock full access to all stories.
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
          </>
        )}
      </div>

      {/* Player fijo al fondo */}
      {story.audioUrl && (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
    <Player
      src={story.audioUrl}
      bookSlug={source}
      storySlug={story.slug}
      canPlay={hasFullAccess}
    />
  </div>
)}

      {!story.audioUrl && source === "polyglot" && story.audioStatus !== "failed" ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#081a31]/95 px-4 py-3 text-center text-sm text-blue-100/85 backdrop-blur">
          Audio is still being prepared. You can start reading now.
        </div>
      ) : null}

      {!story.audioUrl && source === "polyglot" && story.audioStatus === "failed" ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-amber-400/20 bg-[#2b1d10]/95 px-4 py-3 text-center text-sm text-amber-100 backdrop-blur">
          This story is ready to read, but audio is currently unavailable.
        </div>
      ) : null}

      <VocabPanel
        story={{
          id: story.id,
          slug: story.slug,
          title: story.title,
          language: story.language ?? undefined,
          vocab: safeVocab,
        }}
      />

    </div>
  );
}
