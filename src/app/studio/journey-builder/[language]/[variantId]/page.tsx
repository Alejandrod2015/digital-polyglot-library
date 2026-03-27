import StudioShell from "@/components/studio/StudioShell";
import JourneyVariantPlanEditorPageClient from "@/components/studio/JourneyVariantPlanEditorPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

type JourneyVariantBuilderPageProps = {
  params: Promise<{ language: string; variantId: string }>;
  searchParams?: Promise<{
    level?: string;
    topic?: string;
    slot?: string;
    focus?: string;
  }>;
};

export default async function JourneyVariantBuilderPage({
  params,
  searchParams,
}: JourneyVariantBuilderPageProps) {
  const { language, variantId } = await params;
  await requireStudioUser(
    `/studio/journey-builder/${encodeURIComponent(language)}/${encodeURIComponent(variantId)}`
  );
  const resolvedSearch = searchParams ? await searchParams : undefined;

  return (
    <StudioShell
      title="Estructura del Journey"
      description="Aquí defines el currículo real del journey: niveles, topics y cuántas historias necesita cada parte."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Creador de Journeys", href: "/studio/journey-builder" },
        { label: `${decodeURIComponent(language)} / ${decodeURIComponent(variantId).toUpperCase()}` },
      ]}
    >
      <JourneyVariantPlanEditorPageClient
        language={language}
        variantId={variantId}
        highlightedLevel={resolvedSearch?.level ?? null}
        highlightedTopic={resolvedSearch?.topic ?? null}
        highlightedSlot={resolvedSearch?.slot ?? null}
        highlightedFocus={resolvedSearch?.focus ?? null}
      />
    </StudioShell>
  );
}
