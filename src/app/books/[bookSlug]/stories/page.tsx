import ReaderClient from '../ReaderClient';
import { books } from '@/data/books';
import { signCatalogAudioUrl } from '@/lib/mediaSigning';

type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';
export const revalidate = 300;

type ReaderPageProps = {
  params: Promise<{ bookSlug: string }>;
};

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { bookSlug } = await params;
  const book = Object.values(books).find((b) => b.slug === bookSlug);

  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  // Esta pagina entrega el libro ENTERO al cliente, asi que aqui se firma
  // historia por historia; si no, una sola carga deja en el HTML todas las
  // URLs permanentes del libro.
  const signedBook = {
    ...book,
    stories: book.stories.map((story) => ({
      ...story,
      audio: signCatalogAudioUrl(story.audio) ?? story.audio,
    })),
  };

  const plan: UserPlan = 'free';
  return <ReaderClient book={signedBook} userPlan={plan} />;
}
