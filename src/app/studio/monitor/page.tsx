import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage() {
  await requireStudioUser("/studio/monitor");
  return (
    <StudioShell
      title="Monitor"
      description="Estado del sistema de contenido"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Monitor" }]}
    >
      <MonitorClient />
    </StudioShell>
  );
}
