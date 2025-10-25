import ExploreClient from './ExploreClient';
import { getPublicUserStories } from '@/lib/userStories';

export const revalidate = 600;

export default async function ExplorePage() {
  // Traemos las historias desde Prisma
  const stories = await getPublicUserStories();

  // Convertimos nulls → strings vacíos y mantenemos solo los campos usados
  const polyglotStories = stories.map((s) => ({
    id: s.id,
    slug: s.slug,
    title: s.title,
    language: s.language ?? '',
    level: s.level ?? '',
    text: s.text ?? '',
  }));

  return <ExploreClient polyglotStories={polyglotStories} />;
}
