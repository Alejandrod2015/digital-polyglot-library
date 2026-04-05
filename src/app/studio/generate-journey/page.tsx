import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import GenerateJourneyClient from "./GenerateJourneyClient";

export default async function GenerateJourneyPage() {
  await requireStudioUser("/studio/generate-journey");
  return (
    <StudioShell
      title="Generar journey"
      description="Configura y crea un journey de aprendizaje"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Generar journey" }]}
    >
      <GenerateJourneyClient />
    </StudioShell>
  );
}
