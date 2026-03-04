import { prisma } from "@/lib/prisma";
import Player from "@/components/Player";
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getFeaturedStories } from "@/lib/getFeaturedStory";
import AddStoryToLibraryButton from "@/components/AddStoryToLibraryButton";
import ScrollToTopOnPathChange from "@/components/ScrollToTopOnPathChange";
import LevelBadge from "@/components/LevelBadge";
import StoryContent from "@/components/StoryContent";
import VocabPanel from "@/components/VocabPanel";

type StoryPageProps = {
  params: Promise<{ slug: string }>;
};

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

  const story = await prisma.userStory.findUnique({
    where: { slug },
  });

  if (!story) {
    notFound();
  }

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
    plan === "premium" ||
    plan === "polyglot" ||
    plan === "owner" ||
    (plan === "basic" && (isWeeklyStory || isDailyStory)) ||
    (plan === "free" && isWeeklyStory);

  const displayText = hasFullAccess
    ? story.text
    : `${story.text.slice(0, 1000)}…`;
  const normalizedText = normalizePolyglotStoryText(displayText);

  const storyCoverUrl =
    typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
      ? story.coverUrl.startsWith("https://cdn.sanity.io/")
        ? `${story.coverUrl}?w=1200&fit=crop&auto=format`
        : story.coverUrl
      : null;
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
          bookId: "polyglot",
        },
        create: {
          userId,
          storyId: story.id,
          title: story.title,
          coverUrl,
          bookId: "polyglot",
        },
      });
    } catch (err) {
      console.error("[stories/:slug] Failed to auto-save polyglot story", err);
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
          bookId="polyglot"
          title={story.title}
          coverUrl={coverUrl}
          variant="icon"
        />
      </div>

      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-4xl font-bold text-white text-center">
          {story.title}
        </h1>
        <div className="mt-3 flex justify-center">
          <LevelBadge level={story.level ?? undefined} />
        </div>
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

      {/* Texto principal */}
      <div className="relative">
        {hasFullAccess ? (
          <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6">
            <StoryContent
              text={normalizedText}
              sentencesPerParagraph={3}
              vocab={(story.vocab as { word: string; definition: string }[]) ?? []}
            />
          </div>
        ) : (
          <div
            className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6"
            dangerouslySetInnerHTML={{ __html: normalizedText }}
          />
        )}

        {/* Fallback si no tiene acceso */}
        {!hasFullAccess && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[var(--background)] via-[rgba(11,18,32,0.9)] to-transparent z-10" />
            <div className="absolute inset-x-0 bottom-[-8rem] flex flex-col items-center justify-end pb-12 text-center z-20">
              <p className="text-gray-200 text-xl sm:text-xl mb-3 drop-shadow">
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
      bookSlug="polyglot"
      storySlug={story.slug}
      canPlay={hasFullAccess}
    />
  </div>
)}

      <VocabPanel
        story={{
          id: story.id,
          slug: story.slug,
          title: story.title,
          language: story.language ?? undefined,
          vocab: (story.vocab as { word: string; definition: string }[]) ?? [],
        }}
      />

    </div>
  );
}
