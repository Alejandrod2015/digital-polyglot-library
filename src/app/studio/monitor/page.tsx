import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage() {
  await requireStudioUser("/studio/monitor");
  return (
    <StudioShell
      title="Journey Manager"
      description="Crea y gestiona los journeys de aprendizaje"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Journey Manager" }]}
    >
      <MonitorClient />
    </StudioShell>
  );
}
