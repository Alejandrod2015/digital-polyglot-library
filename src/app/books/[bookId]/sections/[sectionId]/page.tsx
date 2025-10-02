import { notFound } from "next/navigation";
import { books } from "@/data/books";

interface SectionPageProps {
  params: Promise<{
    bookId: string;
    sectionId: string;
  }>;
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { bookId, sectionId } = await params; // 👈 desestructuramos del Promise

  // books es un objeto, no un array
  const book = books[bookId];
  if (!book) return notFound();

  const section = book.stories.find((s) => s.id === sectionId);
  if (!section) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{section.title}</h1>
      <p className="mb-6">{section.text}</p>
      <blockquote className="italic border-l-4 border-blue-500 pl-4 mb-6">
        {section.dialogue}
      </blockquote>
      <audio controls src={`${book.audioFolder}/${section.audio}`} />
    </div>
  );
}

export async function generateStaticParams() {
  // usamos Object.values porque books es un objeto
  return Object.values(books).flatMap((book) =>
    book.stories.map((story) => ({
      bookId: book.id,
      sectionId: story.id,
    }))
  );
}
