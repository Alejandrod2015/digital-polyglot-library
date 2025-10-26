import { books } from '@/data/books';
import VocabPanel from '@/components/VocabPanel';
import { currentUser } from '@clerk/nextjs/server';
import Player from '@/components/Player';
import StoryAccessInfo from './StoryAccessInfo';
import AddStoryToLibraryButton from '@/components/AddStoryToLibraryButton';
import StoryClientGate from './StoryClientGate';
import { getFeaturedStory } from '@/lib/getFeaturedStory';
import StoryContent from '@/components/StoryContent';

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

  const weeklyStory = await getFeaturedStory('week');
  const dailyStory = await getFeaturedStory('day');

  const isWeeklyStory = weeklyStory?.slug === story.slug;
  const isDailyStory = dailyStory?.slug === story.slug;

  const hasFullAccess =
    userPlan === 'premium' ||
    userPlan === 'polyglot' ||
    userPlan === 'owner' ||
    ownsThisBook ||
    (userPlan === 'basic' && (isWeeklyStory || isDailyStory)) ||
    (userPlan === 'free' && isWeeklyStory);

  const visibleText = story.text;

  const rawCover =
    (story as { coverUrl?: string })?.coverUrl ??
    (book as { coverUrl?: string; cover?: string })?.coverUrl ??
    (book as { cover?: string })?.cover ??
    '/covers/default.jpg';

  const coverUrl = rawCover.startsWith('https://cdn.sanity.io/')
    ? `${rawCover}?w=800&fit=crop&auto=format`
    : rawCover;

  return (
    <div className="relative max-w-5xl mx-auto pt-1 px-8 pb-[8rem] text-foreground bg-[#0D1B2A]">
      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-4xl font-bold text-white text-center">{story.title}</h1>
      </div>

      {/* Botón de guardar */}
      <div className="absolute top-[-14px] -right-2 sm:top-0 sm:right-0">
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
            <a
              href="/plans"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-medium font-medium rounded-xl shadow-lg transition"
            >
              Upgrade
            </a>
          </div>
        }
      >
        <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-200 space-y-6">
          <StoryContent text={visibleText} sentencesPerParagraph={3} />
        </div>
      </StoryClientGate>

      {/* Player fijo visible en viewport global */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D1B2A] shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
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
