import { books } from '@/data/books';
import VocabPanel from '@/components/VocabPanel';
import { currentUser } from '@clerk/nextjs/server';
import Player from '@/components/Player';
import StoryAccessInfo from './StoryAccessInfo';
import { getStoriesReadCount } from '@/utils/readingLimits';
import { getFreeStorySlugs } from '@/data/freeStories';
import AddStoryToLibraryButton from '@/components/AddStoryToLibraryButton'; // 👈 nuevo import

type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';

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

  const user = await currentUser();
  const userPlan = (user?.publicMetadata?.plan as UserPlan) || 'free';

  const booksMeta = user?.publicMetadata?.books;
  const ownedBooks = Array.isArray(booksMeta)
    ? (booksMeta as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const ownsThisBook = ownedBooks.includes(book.slug);

  const promotionalSlugs = await getFreeStorySlugs();

  let hasFullAccess =
    (userPlan === 'free' && promotionalSlugs.includes(story.slug)) ||
    userPlan === 'premium' ||
    userPlan === 'polyglot' ||
    ownsThisBook;

  if (!hasFullAccess && (userPlan === 'free' || userPlan === 'basic')) {
    const limit = userPlan === 'free' ? 10 : 1;
    const readCount = getStoriesReadCount(userPlan);
    if (readCount < limit) {
      hasFullAccess = true;
    }
  }

  const paragraphs = story.text
    .split(/<\/p>/)
    .filter(Boolean)
    .map((p) => p + '</p>');

  const visibleCount = hasFullAccess
    ? paragraphs.length
    : Math.max(1, Math.ceil(paragraphs.length * 0.2));

  const visibleText = paragraphs.slice(0, visibleCount).join('');

  // ✅ usa cover del libro si la historia no tiene propia
  const rawCover =
  (story as { coverUrl?: string })?.coverUrl ??
  (book as { coverUrl?: string; cover?: string })?.coverUrl ??
  (book as { cover?: string })?.cover ??
  '/covers/default.jpg';

const coverUrl = rawCover.startsWith('https://cdn.sanity.io/')
  ? `${rawCover}?w=800&fit=crop&auto=format`
  : rawCover;

  return (
    <div className="relative max-w-5xl mx-auto p-8 pb-32 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">{story.title}</h1>
        {/* 👇 nuevo botón */}
        <AddStoryToLibraryButton
          storyId={story.id}
          bookId={book.id}
          title={story.title}
          coverUrl={coverUrl}
        />
      </div>

      {/* Contador de lecturas */}
      <StoryAccessInfo storyId={story.id} userPlan={userPlan} />

      {/* Texto visible */}
      <div
        className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6 relative"
        dangerouslySetInnerHTML={{ __html: visibleText }}
      />

      {!hasFullAccess && (
        <div className="absolute inset-x-0 bottom-0 min-h-[30vh] flex flex-col justify-end items-center bg-gradient-to-t from-background/95 via-background/70 to-transparent pb-12 sm:pb-16">
          <div className="backdrop-blur-sm p-4 text-center max-w-sm mx-auto">
            <p className="text-gray-300 mb-3 text-sm sm:text-base">
              Estás leyendo una vista previa. Desbloquea la historia completa para continuar.
            </p>
            <a
              href="/upgrade"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition"
            >
              Desbloquear historia completa
            </a>
          </div>
        </div>
      )}

      {hasFullAccess ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
          <Player
            src={`${book.audioFolder}/${story.audio}`}
            bookSlug={book.slug}
            storySlug={story.slug}
          />
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur border-t border-gray-800 text-center py-6 text-gray-400">
          🔒 El audio está disponible solo para usuarios con acceso al libro o plan Premium.
        </div>
      )}

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
