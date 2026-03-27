import { books } from "@/data/books";
import VocabPanel from "@/components/VocabPanel";
import Image from "next/image";
import { auth, currentUser } from "@clerk/nextjs/server";
import Player from "@/components/Player";
import StoryAccessInfo from "./StoryAccessInfo";
import AddStoryToLibraryButton from "@/components/AddStoryToLibraryButton";
import StoryClientGate from "./StoryClientGate";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import StoryContent from "@/components/StoryContent";
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
import { freshClient } from "@/sanity/lib/client";
import type { Book, Story } from "@/types/books";

type UserPlan = "free" | "basic" | "premium" | "polyglot" | "owner";

type StoryPageProps = {
  params: Promise<{ bookSlug: string; storySlug: string }>;
  searchParams: Promise<{
    returnTo?: string;
    returnLabel?: string;
    from?: string;
  }>;
};

type LiveBookStoryResult = {
  book: Book;
  story: Story;
} | null;

async function getLiveBookStory(bookSlug: string, storySlug: string): Promise<LiveBookStoryResult> {
  const query = `*[_type == "book" && slug.current == $bookSlug && published == true][0]{
    "id": coalesce(id.current, slug.current, _id),
    "slug": coalesce(slug.current, id.current, _id),
    title,
    description,
    level,
    language,
    region,
    topic,
    formality,
    audioFolder,
    storeUrl,
    "cover": select(
      defined(cover.asset->url) => cover.asset->url,
      "/covers/default.jpg"
    ),
    "story": *[_type == "story" && references(^._id) && slug.current == $storySlug && published == true][0]{
      "id": coalesce(slug.current, _id),
      "slug": coalesce(slug.current, _id),
      title,
      text,
      "audio": coalesce(audio.asset->url, ""),
      "cover": select(
        defined(cover.asset->url) => cover.asset->url,
        null
      ),
      coverUrl,
      topic,
      vocabRaw,
      level,
      cefrLevel,
      language,
      region,
      variant
    }
  }`;

  const result = await freshClient.fetch<Record<string, unknown> | null>(query, { bookSlug, storySlug });
  if (!result || typeof result !== "object") return null;
  const story = result.story as Record<string, unknown> | undefined;
  if (!story || typeof story !== "object") return null;

  const normalizedStory: Story = {
    id: typeof story.id === "string" ? story.id : storySlug,
    slug: typeof story.slug === "string" ? story.slug : storySlug,
    title: typeof story.title === "string" ? story.title : "Untitled",
    text: typeof story.text === "string" ? story.text : "",
    audio: typeof story.audio === "string" ? story.audio : "",
    cover: typeof story.cover === "string" ? story.cover : undefined,
    coverUrl: typeof story.coverUrl === "string" ? story.coverUrl : undefined,
    topic: typeof story.topic === "string" ? story.topic : undefined,
    vocab: Array.isArray(story.vocabRaw) ? (story.vocabRaw as Story["vocab"]) : [],
    level: typeof story.level === "string" ? (story.level as Story["level"]) : undefined,
    cefrLevel: typeof story.cefrLevel === "string" ? (story.cefrLevel as Story["cefrLevel"]) : undefined,
    language: typeof story.language === "string" ? story.language : undefined,
    region: typeof story.region === "string" ? story.region : undefined,
    variant: typeof story.variant === "string" ? story.variant : undefined,
  };

  const normalizedBook: Book = {
    id: typeof result.id === "string" ? result.id : bookSlug,
    slug: typeof result.slug === "string" ? result.slug : bookSlug,
    title: typeof result.title === "string" ? result.title : bookSlug,
    description: typeof result.description === "string" ? result.description : "",
    level: typeof result.level === "string" ? (result.level as Book["level"]) : "beginner",
    language: typeof result.language === "string" ? result.language : "english",
    region: typeof result.region === "string" ? result.region : undefined,
    topic: typeof result.topic === "string" ? result.topic : undefined,
    formality:
      typeof result.formality === "string"
        ? (result.formality as Book["formality"])
        : undefined,
    audioFolder: typeof result.audioFolder === "string" ? result.audioFolder : "",
    storeUrl: typeof result.storeUrl === "string" ? result.storeUrl : undefined,
    cover: typeof result.cover === "string" ? result.cover : "/covers/default.jpg",
    stories: [normalizedStory],
  };

  return { book: normalizedBook, story: normalizedStory };
}

export default async function StoryPage({ params, searchParams }: StoryPageProps) {
  const { bookSlug, storySlug } = await params;
  const { returnTo, returnLabel, from } = await searchParams;
  const staticBook = Object.values(books).find((b) => b.slug === bookSlug);
  const staticStory = staticBook?.stories.find((s) => s.slug === storySlug);
  const shouldTryLive = process.env.NODE_ENV !== "production";
  const live = shouldTryLive && (!staticBook || !staticStory || (!staticStory.cover && !staticStory.coverUrl))
    ? await getLiveBookStory(bookSlug, storySlug)
    : null;
  const book = live?.book ?? staticBook;
  const story = live?.story ?? staticStory;

  if (!book || !story) {
    return <div className="p-8 text-center">Historia no encontrada.</div>;
  }

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
    <div className="relative max-w-5xl mx-auto pt-1 px-8 pb-[8rem] text-foreground">
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
        <h1 className="text-4xl font-bold text-[var(--foreground)] text-center">{story.title}</h1>
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
            <div className="relative w-full md:hidden aspect-[16/10]">
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
            <p className="mb-4 text-xl text-[var(--foreground)]">Unlock full access to all stories.</p>
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
          <>
            <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
              <StoryContent text={visibleText} sentencesPerParagraph={3} vocab={story.vocab ?? []} />
            </div>
          </>
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
