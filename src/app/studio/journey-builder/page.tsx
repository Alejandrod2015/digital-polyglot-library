import StudioShell from "@/components/studio/StudioShell";
import JourneyBuilderPageClient from "@/components/studio/JourneyBuilderPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function JourneyBuilderPage() {
  await requireStudioUser("/studio/journey-builder");

  return (
    <StudioShell
      title="Creador de Journeys"
      description="Crea journeys nuevos y organiza su estructura real: variante, niveles, topics y meta de historias."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Creador de Journeys" },
      ]}
    >
      <JourneyBuilderPageClient />
    </StudioShell>
  );
}
