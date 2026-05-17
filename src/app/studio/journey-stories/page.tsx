import StudioShell from "@/components/studio/StudioShell";
import JourneyStoriesPageClient from "@/components/studio/JourneyStoriesPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function JourneyStoriesPage() {
  await requireStudioUser("/studio/journey-stories");

  return (
    <StudioShell
      title="Stories library"
      description="Aquí puedes revisar y editar historias existentes. Para crear journeys nuevos y completarlos, la entrada principal ahora es el creador."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Stories library" },
      ]}
    >
      <JourneyStoriesPageClient />
    </StudioShell>
  );
}
