import StudioShell from "@/components/studio/StudioShell";
import JourneyBuilderPageClient from "@/components/studio/JourneyBuilderPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function JourneyBuilderPage() {
  await requireStudioUser("/studio/journey-builder");

  return (
    <StudioShell
      title="Journey Builder"
      description="Manage the actual structure of Journey here: variants, levels, topics, and story targets."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Journey Builder" },
      ]}
    >
      <JourneyBuilderPageClient />
    </StudioShell>
  );
}
