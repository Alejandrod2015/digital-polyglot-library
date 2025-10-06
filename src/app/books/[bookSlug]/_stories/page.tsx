import ReaderClient from '../ReaderClient';
import { books } from '@/data/books';

// params es Promise en este wrapper de servidor
type ReaderPageProps = {
  params: Promise<{ bookSlug: string }>;
};

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { bookSlug } = await params;

  const book = Object.values(books).find((b) => b.slug === bookSlug);
  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  return <ReaderClient book={book} />;
}
