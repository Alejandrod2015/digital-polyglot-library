import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import PlannerClient from "./PlannerClient";

export default async function PlannerPage() {
  await requireStudioUser("/studio/planner");
  return (
    <StudioShell
      title="Planner"
      description="Detecta gaps en el catálogo y crea journeys nuevos."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Planner" }]}
    >
      <PlannerClient />
    </StudioShell>
  );
}
