import { notFound } from "next/navigation";
import { books } from "@/data/books";
import Player from "@/components/Player";

interface SectionPageProps {
  params: Promise<{
    bookId: string;
    sectionId: string;
  }>;
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { bookId, sectionId } = await params;

  const book = books[bookId];
  if (!book) return notFound();

  const section = book.stories.find((s) => s.id === sectionId);
  if (!section) return notFound();

  return (
    <div className="relative min-h-screen flex flex-col pb-40 bg-background text-foreground">
      {/* Contenido principal */}
      <div className="p-6 flex-1 text-foreground">
        <h1 className="text-4xl font-bold mb-6 text-center">{section.title}</h1>
        <div
  className="max-w-[65ch] mx-auto text-xl leading-relaxed text-gray-400 space-y-6"
  dangerouslySetInnerHTML={{ __html: section.text }}
/>

        <blockquote className="italic border-l-4 border-blue-500 pl-4 mb-6 max-w-[60ch] mx-auto text-gray-400 leading-8 sm:leading-9">
        </blockquote>

      </div>

      {/* Player fijo en la parte inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:ml-64">
        <Player src={`${book.audioFolder}/${section.audio}`} />
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return Object.values(books).flatMap((book) =>
    book.stories.map((story) => ({
      bookId: book.id,
      sectionId: story.id,
    }))
  );
}
