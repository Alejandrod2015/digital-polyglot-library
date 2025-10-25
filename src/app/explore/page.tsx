import ExploreClient from './ExploreClient';

export const revalidate = 600; // ♻️ revalida cada 10 minutos

export default async function ExplorePage() {
  // ✅ Detectar entorno y construir la URL base correcta
  let baseUrl: string;

  if (process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  } else if (process.env.NEXT_PUBLIC_BASE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  } else {
    baseUrl = 'http://localhost:3000'; // desarrollo local
  }

  let data: { stories: any[] } = { stories: [] };

  try {
    const res = await fetch(`${baseUrl}/api/user-stories`, {
      next: { revalidate: 600 },
    });

    if (res.ok) data = await res.json();
  } catch (error) {
    console.error('Error fetching stories:', error);
  }

  return <ExploreClient polyglotStories={data.stories || []} />;
}
