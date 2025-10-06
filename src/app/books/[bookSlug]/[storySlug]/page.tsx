import { books } from "@/data/books";
import StoryReaderClient from "../StoryReaderClient";
import { LEVEL_LABELS } from "@/types/books";

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

  return (
  <div className="max-w-5xl mx-auto p-8">
    {book.level && (
      <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
        {LEVEL_LABELS[book.level]}
      </span>
    )}
    <StoryReaderClient book={book} story={story} />
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
