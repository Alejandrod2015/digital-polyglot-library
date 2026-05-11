import StudioShell from "@/components/studio/StudioShell";
import StandaloneStoriesPageClient from "@/components/studio/StandaloneStoriesPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function StandaloneStoriesPage() {
  await requireStudioUser("/studio/standalone-stories");

  return (
    <StudioShell
      title="Standalone stories"
      description="Editor nativo de historias sueltas (antes en Sanity Studio). Crea, edita y publica directamente contra Studio."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Standalone stories" },
      ]}
    >
      <StandaloneStoriesPageClient />
    </StudioShell>
  );
}
