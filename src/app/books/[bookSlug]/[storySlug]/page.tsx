import { books } from "@/data/books";
import VocabPanel from "@/components/VocabPanel";
import Image from "next/image";
import { auth, currentUser } from "@clerk/nextjs/server";
import Player from "@/components/Player";
import OnboardingPlayCoachmark from "@/components/OnboardingPlayCoachmark";
import StoryAccessInfo from "./StoryAccessInfo";
import AddStoryToLibraryButton from "@/components/AddStoryToLibraryButton";
import StoryClientGate from "./StoryClientGate";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import StoryContent from "@/components/StoryContent";
import HighlightedStoryReader from "@/components/HighlightedStoryReader";
import { prisma } from "@/lib/prisma";
import ScrollToTopOnPathChange from "@/components/ScrollToTopOnPathChange";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import {
  isSanityAssetUrl,
  resolvePublicMediaUrl,
  shouldBypassImageOptimization,
} from "@/lib/publicMedia";
import { canAccessStoryContent } from "@domain/access";
import { getLockedStoryPreviewHtml } from "@domain/lockedStoryPreview";
import { getCatalogStory } from "@/lib/catalog";

type UserPlan = "free" | "basic" | "premium" | "polyglot" | "owner";

type StoryPageProps = {
  params: Promise<{ bookSlug: string; storySlug: string }>;
  searchParams: Promise<{
    returnTo?: string;
    returnLabel?: string;
    from?: string;
  }>;
};

export default async function StoryPage({ params, searchParams }: StoryPageProps) {
  const { bookSlug, storySlug } = await params;
  const { returnTo, returnLabel, from } = await searchParams;
  // Studio catalog is the source of truth; static dump is a last-resort
  // fallback for slugs that haven't been migrated.
  const studio = await getCatalogStory(bookSlug, storySlug);
  const fallbackBook = Object.values(books).find((b) => b.slug === bookSlug);
  const fallbackStory = fallbackBook?.stories.find((s) => s.slug === storySlug);
  const book = studio?.book ?? fallbackBook;
  const story = studio?.story ?? fallbackStory;

  // Stories of unpublished catalog books must not render, even by direct URL.
  if (!book || !story || book.published === false) {
    return <div className="p-8 text-center">Historia no encontrada.</div>;
  }

  // Opt-in word-level karaoke. Only stories aligned via the studio
  // pipeline have `audioWordTimings` populated; the rest stay on the
  // plain StoryContent path. Mirrors the lookup in
  // src/app/stories/[slug]/page.tsx so the books reader matches iOS,
  // which already consumes the same payload via /api/mobile/audio-word-timings.
  const journeyStoryRow = await prisma.journeyStory
    .findFirst({
      where: { slug: story.slug, status: "published" },
      select: { audioWordTimings: true },
    })
    .catch(() => null);
  const audioWordTimings = journeyStoryRow?.audioWordTimings ?? null;
  const hasWordTimings =
    audioWordTimings !== null && typeof audioWordTimings === "object";

  const { userId } = await auth();
  const [user, featured] = await Promise.all([
    userId ? currentUser() : Promise.resolve(null),
    getFeaturedStories(),
  ]);
  const userPlan = (user?.publicMetadata?.plan as UserPlan) || "free";

  const booksMeta = user?.publicMetadata?.books;
  const ownedBooks = Array.isArray(booksMeta)
    ? (booksMeta as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const ownsThisBook = ownedBooks.includes(book.slug);

  const isWeeklyStory = featured.week?.slug === story.slug;
  const isDailyStory = featured.day?.slug === story.slug;
  const storyIndex = book.stories.findIndex((s) => s.slug === story.slug || s.id === story.id);
  const prevStorySlug = storyIndex > 0 ? book.stories[storyIndex - 1]?.slug ?? null : null;
  const nextStorySlug =
    storyIndex >= 0 && storyIndex < book.stories.length - 1
      ? book.stories[storyIndex + 1]?.slug ?? null
      : null;

  const hasFullAccess = canAccessStoryContent({
    plan: userPlan,
    ownsBook: ownsThisBook,
    isWeeklyStory,
    isDailyStory,
  });

  const visibleText = story.text;
  const lockedPreviewHtml = getLockedStoryPreviewHtml(story.text);
  const hasStoryAudio = typeof story.audio === "string" && story.audio.trim() !== "";

  const resolvedStoryCoverSource =
    typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
      ? story.coverUrl
      : story.cover;
  const storyCover =
    typeof resolvedStoryCoverSource === "string" && resolvedStoryCoverSource.trim() !== ""
      ? resolvePublicMediaUrl(resolvedStoryCoverSource) ?? resolvedStoryCoverSource
      : null;
  const rawCover =
    resolvePublicMediaUrl(resolvedStoryCoverSource ?? story.cover ?? book.cover ?? "/covers/default.jpg") ??
    "/covers/default.jpg";

  const storyCoverUrl = storyCover && isSanityAssetUrl(storyCover)
    ? `${storyCover}?auto=format`
    : storyCover;
  const storyCoverBlurUrl = storyCover && isSanityAssetUrl(storyCover)
    ? `${storyCover}?w=160&blur=40&auto=format`
    : storyCoverUrl;
  const coverUrl = isSanityAssetUrl(rawCover)
    ? `${rawCover}?w=800&fit=crop&auto=format`
    : rawCover;
  const unoptimizedStoryCover = shouldBypassImageOptimization(storyCoverUrl);
  const unoptimizedStoryCoverBlur = shouldBypassImageOptimization(storyCoverBlurUrl);
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(
    `/books/${book.slug}/${story.slug}`
  )}`;
  const resolvedReturnHref =
    typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : from === "my-library"
        ? "/my-library"
        : `/books/${book.slug}`;
  const resolvedReturnLabel =
    typeof returnLabel === "string" && returnLabel.trim()
      ? returnLabel.trim()
      : from === "my-library"
        ? "Back to My Library"
        : "Back to book";
  const currentStorySearch = new URLSearchParams();
  if (resolvedReturnHref) currentStorySearch.set("returnTo", resolvedReturnHref);
  if (resolvedReturnLabel) currentStorySearch.set("returnLabel", resolvedReturnLabel);
  if (typeof from === "string" && from.trim()) currentStorySearch.set("from", from.trim());
  const currentStoryHref = `/books/${book.slug}/${story.slug}${currentStorySearch.toString() ? `?${currentStorySearch.toString()}` : ""}`;
  const nextStoryHref = nextStorySlug
    ? `/books/${book.slug}/${nextStorySlug}${currentStorySearch.toString() ? `?${currentStorySearch.toString()}` : ""}`
    : null;
  const practiceParams = new URLSearchParams({
    source: "story",
    storySlug: story.slug,
    bookSlug: book.slug,
    storyTitle: story.title,
    storyHref: currentStoryHref,
  });
  if (nextStoryHref) practiceParams.set("nextHref", nextStoryHref);
  if (resolvedReturnHref) practiceParams.set("returnTo", resolvedReturnHref);
  if (resolvedReturnLabel) practiceParams.set("returnLabel", resolvedReturnLabel);
  return (
    <div className="relative max-w-5xl mx-auto pt-1 px-5 md:px-8 pb-[8rem] text-foreground">
      <ScrollToTopOnPathChange />
      {/* Botón de guardar */}
      <div className="absolute top-[-2.75rem] right-6 z-30 sm:right-8">
        <AddStoryToLibraryButton
          storyId={story.id}
          bookId={book.id}
          title={story.title}
          coverUrl={coverUrl}
          variant="icon"
        />
      </div>

      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] text-center">{story.title}</h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <LevelBadge level={story.level ?? book.level} />
          <LanguageBadge language={story.language ?? book.language} />
          <RegionBadge region={story.region ?? book.region} />
        </div>
      </div>

      {/* Cover de historia (solo si existe) */}
      {storyCoverUrl ? (
        <div className="mb-7">
          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#102746] md:h-[220px] lg:h-[240px]">
            <div className="relative w-full md:hidden aspect-[2/1]">
              <Image
                src={storyCoverUrl}
                alt={story.title}
                fill
                priority
                unoptimized={unoptimizedStoryCover}
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
                unoptimized={unoptimizedStoryCoverBlur}
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
                unoptimized={unoptimizedStoryCover}
                sizes="(max-width: 1024px) 896px, 960px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Info de acceso */}
      <StoryAccessInfo storyId={story.id} userPlan={userPlan} />

      {/* Texto principal con control de acceso */}
      <StoryClientGate
        plan={userPlan}
        storyId={story.id}
        forceAllow={hasFullAccess}
        fallback={
          <div className="relative text-center text-[var(--muted)] py-16">
            <p className="mb-4 text-xl text-[var(--foreground)]">Unlock every story and master the real language inside.</p>
            <div className="flex items-center justify-center gap-3">
              {!userId ? (
                <a
                  href={signInHref}
                  className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-medium font-medium rounded-xl shadow-lg transition"
                >
                  Sign in
                </a>
              ) : null}
              <a
                href="/plans"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-medium font-medium rounded-xl shadow-lg transition"
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
              <HighlightedStoryReader
                story={{ vocab: story.vocab ?? [] }}
                audioWordTimings={audioWordTimings}
              />
            ) : (
              <StoryContent text={visibleText} sentencesPerParagraph={3} vocab={story.vocab ?? []} />
            )}
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6"
            dangerouslySetInnerHTML={{ __html: lockedPreviewHtml }}
          />
        )}
      </StoryClientGate>

      {/* Player fijo visible en viewport global */}
      {hasStoryAudio ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
          <OnboardingPlayCoachmark />
          <Player
            src={story.audio}
            bookSlug={book.slug}
            storySlug={story.slug}
            canPlay={hasFullAccess}
            prevStorySlug={prevStorySlug}
            nextStorySlug={nextStorySlug}
            continueMeta={{
              title: story.title,
              bookTitle: book.title,
              cover: rawCover,
              language: story.language ?? book.language,
              level: story.level ?? book.level,
              topic: story.topic ?? book.topic,
            }}
          />
        </div>
      ) : null}

      <VocabPanel story={story} />
    </div>
  );
}

export function generateStaticParams() {
  return Object.values(books).flatMap((book) =>
    book.stories.map((story) => ({
      bookSlug: book.slug,
      storySlug: story.slug,
    }))
  );
}
