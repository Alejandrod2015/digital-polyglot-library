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
    <div className="relative max-w-5xl mx-auto pt-10 px-8 pb-[8rem] text-foreground">
      <ScrollToTopOnPathChange />
      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-4xl font-bold text-white text-center">{story.title}</h1>
      </div>

      {/* Cover de historia (solo si existe) */}
      {storyCoverUrl ? (
        <div className="mb-7">
          <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-[#102746] lg:max-h-[240px]">
            <img
              src={storyCoverUrl}
              alt={story.title}
              className="w-full h-auto object-cover lg:h-[240px]"
            />
          </div>
        </div>
      ) : null}

      {/* Botón de guardar */}
      <div className="absolute top-0 right-2">
        <AddStoryToLibraryButton
          storyId={story.id}
          bookId={book.id}
          title={story.title}
          coverUrl={coverUrl}
          variant="icon"
        />
      </div>

      {/* Info de acceso */}
      <StoryAccessInfo storyId={story.id} userPlan={userPlan} />

      {/* Texto principal con control de acceso */}
      <StoryClientGate
        plan={userPlan}
        storyId={story.id}
        forceAllow={hasFullAccess}
        fallback={
          <div className="relative text-center text-gray-300 py-16">
            <p className="mb-4 text-xl">Unlock full access to all stories.</p>
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
          <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6">
            <StoryContent text={visibleText} sentencesPerParagraph={3} vocab={story.vocab ?? []} />
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6"
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
