import ExploreClient from './ExploreClient';

export const revalidate = 600; // ♻️ revalida cada 10 minutos

export default async function ExplorePage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  let data: { stories: any[] } = { stories: [] };

  try {
    const res = await fetch(`${baseUrl}/api/user-stories`, {
      // ✅ SSR cache inteligente
      next: { revalidate: 600 },
    });

    if (res.ok) data = await res.json();
  } catch {
    // Si la API falla, simplemente seguimos con historias vacías
  }

  return <ExploreClient polyglotStories={data.stories || []} />;
}
