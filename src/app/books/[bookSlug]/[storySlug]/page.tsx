import { books } from '@/data/books';
import VocabPanel from '@/components/VocabPanel';
import { currentUser } from '@clerk/nextjs/server';
import Player from '@/components/Player';
import StoryAccessInfo from './StoryAccessInfo';
import AddStoryToLibraryButton from '@/components/AddStoryToLibraryButton';
import StoryClientGate from './StoryClientGate';
import { getFeaturedStory } from '@/lib/getFeaturedStory';

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

  // 👇 obtenemos historia destacada semanal y diaria
  const weeklyStory = await getFeaturedStory('week');
  const dailyStory = await getFeaturedStory('day');

  const isWeeklyStory = weeklyStory?.slug === story.slug;
  const isDailyStory = dailyStory?.slug === story.slug;

  // 🔐 lógica de acceso unificada
  const hasFullAccess =
    isWeeklyStory ||
    isDailyStory ||
    userPlan === 'premium' ||
    userPlan === 'polyglot' ||
    ownsThisBook;

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
        <AddStoryToLibraryButton
          storyId={story.id}
          bookId={book.id}
          title={story.title}
          coverUrl={coverUrl}
        />
      </div>

      {/* Contador de lecturas */}
      <StoryAccessInfo storyId={story.id} userPlan={userPlan} />

      {/* Texto y audio controlados por el mismo gate */}
      <StoryClientGate
        plan={userPlan}
        forceAllow={hasFullAccess}
        fallback={
  <div className="relative">
    {/* Degradado sobre el final del texto */}
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A]/90 to-transparent z-10" />

    {/* CTA mucho más abajo, completamente fuera del texto */}
    <div className="absolute inset-x-0 bottom-[-8rem] flex flex-col items-center justify-end pb-12 text-center z-20">
      <p className="text-gray-200 text-xl sm:text-xl mb-3 drop-shadow">
        Unlock full access to all stories.
      </p>
      <a
        href="/plans"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-medium font-medium rounded-xl shadow-lg transition"
      >
        Upgrade
      </a>
    </div>

    {/* 🎧 Player siempre visible */}
    <div className="fixed bottom-0 left-0 right-0 z-30 md:ml-64">
      <Player
        src={
          story.audio.startsWith('http')
            ? story.audio
            : `${book.audioFolder?.replace(/\/$/, '') ?? ''}/${story.audio}`
        }
        bookSlug={book.slug}
        storySlug={story.slug}
      />
    </div>
  </div>
}


      >
        {/* Texto visible */}
        <div
          className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6 relative"
          dangerouslySetInnerHTML={{ __html: visibleText }}
        />

        {/* 🎧 El audio se muestra solo si la historia está disponible */}
        <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
          <Player
            src={
              story.audio.startsWith('http')
                ? story.audio
                : `${book.audioFolder?.replace(/\/$/, '') ?? ''}/${story.audio}`
            }
            bookSlug={book.slug}
            storySlug={story.slug}
          />
        </div>
      </StoryClientGate>

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
