import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import {
  aggregateJourneyVocab,
  listJourneysWithVocab,
} from "@/lib/studioVocabulary";
import VocabularyClient from "./VocabularyClient";

type Props = {
  searchParams: Promise<{ journeyId?: string }>;
};

export default async function VocabularyPage({ searchParams }: Props) {
  await requireStudioUser("/studio/vocabulary");

  const journeys = await listJourneysWithVocab();
  const sp = await searchParams;
  // Default to the journey with the most stories (the "active" one).
  const fallback = journeys.sort((a, b) => b.storyCount - a.storyCount)[0];
  const selectedId = sp.journeyId || fallback?.id || null;

  const rows = selectedId ? await aggregateJourneyVocab(selectedId) : [];

  return (
    <StudioShell
      title="Vocabulario del journey"
      description="Una tabla con todas las palabras únicas, sus definiciones y las historias que las usan. Cuando una palabra tiene varias definiciones distintas se marca con ⚠ y puedes elegir una para hacerla canónica (se aplica a todas las historias del journey de una sola vez)."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Vocabulario" },
      ]}
    >
      <VocabularyClient
        journeys={journeys}
        selectedId={selectedId}
        rows={rows}
      />
    </StudioShell>
  );
}
