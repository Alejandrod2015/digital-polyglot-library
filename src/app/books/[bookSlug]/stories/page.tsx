import ReaderClient from '../ReaderClient';
import { books } from '@/data/books';

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

  const plan: UserPlan = 'free';
  return <ReaderClient book={book} userPlan={plan} />;
}
