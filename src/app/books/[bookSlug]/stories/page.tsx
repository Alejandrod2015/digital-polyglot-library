import { currentUser } from '@clerk/nextjs/server';
import ReaderClient from '../ReaderClient';
import { books } from '@/data/books';

type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';

type ReaderPageProps = {
  params: Promise<{ bookSlug: string }>;
};

export default async function ReaderPage({ params }: ReaderPageProps) {
  const { bookSlug } = await params;
  const book = Object.values(books).find((b) => b.slug === bookSlug);

  if (!book) {
    return <div className="p-8 text-center">Libro no encontrado.</div>;
  }

  const user = await currentUser();

  console.log('🧩 currentUser():', JSON.stringify(user, null, 2));

  const plan = (user?.publicMetadata?.plan as UserPlan) || 'free';
  console.log('📗 Server plan:', plan);

  return <ReaderClient book={book} userPlan={plan} />;
}
