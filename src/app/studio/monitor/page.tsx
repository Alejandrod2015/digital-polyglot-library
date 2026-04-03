import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage() {
  await requireStudioUser("/studio/monitor");
  return (
    <StudioShell
      title="Generar historia"
      description="Crea historias para los journeys de aprendizaje"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Generar historia" }]}
    >
      <MonitorClient />
    </StudioShell>
  );
}
