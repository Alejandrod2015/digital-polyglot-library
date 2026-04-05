import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import PlanningClient from "./PlanningClient";

export default async function PlanningPage() {
  await requireStudioUser("/studio/planning");
  return (
    <StudioShell
      title="Planning"
      description="Configura los temas, idiomas y niveles disponibles para crear journeys"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Planning" }]}
    >
      <PlanningClient />
    </StudioShell>
  );
}
