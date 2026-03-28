import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import ContentClient from "./ContentClient";

export default async function ContentPage() {
  await requireStudioUser("/studio/content");

  return (
    <StudioShell
      title="Content Agent"
      description="Genera borradores de historias a partir de briefs curriculares."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Content Agent" },
      ]}
    >
      <ContentClient />
    </StudioShell>
  );
}
