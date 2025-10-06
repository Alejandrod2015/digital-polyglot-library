import { books } from "@/data/books";
import StoryReaderClient from "../StoryReaderClient";

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
    <div className="max-w-5xl mx-auto p-8 pb-32">
      {/* ✅ ÚNICO título */}
      <h1 className="text-3xl font-bold mb-6 text-white">{story.title}</h1>

      {/* ✅ Solo el lector (sin repetir el título) */}
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
