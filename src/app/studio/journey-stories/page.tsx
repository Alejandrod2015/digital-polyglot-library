import StudioShell from "@/components/studio/StudioShell";
import JourneyStoriesPageClient from "@/components/studio/JourneyStoriesPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function JourneyStoriesPage() {
  await requireStudioUser("/studio/journey-stories");

  return (
    <StudioShell
      title="Journey Stories"
      description="Start managing the stories that feed Journey here, while the legacy Sanity flow stays intact underneath."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Journey Stories" },
      ]}
    >
      <JourneyStoriesPageClient />
    </StudioShell>
  );
}
