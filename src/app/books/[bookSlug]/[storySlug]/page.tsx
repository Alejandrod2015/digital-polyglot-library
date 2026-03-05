import { books } from "@/data/books";
import VocabPanel from "@/components/VocabPanel";
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

type UserPlan = "free" | "basic" | "premium" | "polyglot" | "owner";

type StoryPageProps = {
  params: Promise<{ bookSlug: string; storySlug: string }>;
};

export default async function StoryPage({ params }: StoryPageProps) {
  const { bookSlug, storySlug } = await params;
  const book = Object.values(books).find((b) => b.slug === bookSlug);
  const story = book?.stories.find((s) => s.slug === storySlug);

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

  const hasFullAccess =
    userPlan === "premium" ||
    userPlan === "polyglot" ||
    userPlan === "owner" ||
    ownsThisBook ||
    (userPlan === "basic" && (isWeeklyStory || isDailyStory)) ||
    (userPlan === "free" && isWeeklyStory);

  const visibleText = story.text;
  const hasStoryAudio = typeof story.audio === "string" && story.audio.trim() !== "";

  const storyCover = typeof story.cover === "string" && story.cover.trim() !== "" ? story.cover : null;
  const rawCover = story.cover ?? book.cover ?? "/covers/default.jpg";

  const storyCoverUrl = storyCover?.startsWith("https://cdn.sanity.io/")
    ? `${storyCover}?w=1200&fit=crop&auto=format`
    : storyCover;
  const coverUrl = rawCover.startsWith("https://cdn.sanity.io/")
    ? `${rawCover}?w=800&fit=crop&auto=format`
    : rawCover;
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(
    `/books/${book.slug}/${story.slug}`
  )}`;

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
          <div className="relative mx-auto w-full max-w-3xl h-[220px] lg:h-[240px] overflow-hidden rounded-2xl border border-white/10 bg-[#102746]">
            {/* Backdrop blur based on the same cover so empty areas look intentional */}
            <img
              src={storyCoverUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-65"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--bg-content) 16%, transparent) 0%, color-mix(in srgb, var(--bg-content) 54%, transparent) 100%)",
              }}
            />
            <img
              src={storyCoverUrl}
              alt={story.title}
              className="relative z-10 w-full h-full object-contain p-1.5 sm:p-2"
            />
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
          <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
            <StoryContent text={visibleText} sentencesPerParagraph={3} vocab={story.vocab ?? []} />
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6"
            dangerouslySetInnerHTML={{ __html: visibleText }}
          />
        )}
      </StoryClientGate>

      {/* Player fijo visible en viewport global */}
      {hasStoryAudio ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
          <Player
            src={
              story.audio.startsWith("http")
                ? story.audio
                : `${book.audioFolder?.replace(/\/$/, "") ?? ""}/${story.audio}`
            }
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
