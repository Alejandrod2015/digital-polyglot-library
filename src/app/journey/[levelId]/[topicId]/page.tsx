import { redirect } from "next/navigation";

// La home (`/`) ES el journey: diseño de cards, paridad con mobile
// (ver src/app/page.tsx → JourneyClient). Esta ruta vieja
// `/journey/[levelId]/[topicId]` tenía un renderer DIVERGENTE y
// desactualizado (pills "Read 0/3 required", "Journey score", copy de
// lectura que choca con el posicionamiento). Se redirige a la home para que
// esa versión no se vea nunca; deep links / bookmarks siguen funcionando.
// Los componentes StoryJourneyClient + JourneyMilestoneBanner quedan
// huérfanos a partir de aquí.
export default async function JourneyTopicPage({
  searchParams,
}: {
  params: Promise<{ levelId: string; topicId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;
  redirect(variant ? `/?variant=${encodeURIComponent(variant)}` : "/");
}
