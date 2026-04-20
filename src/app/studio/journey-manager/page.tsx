import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import MonitorClient from "./MonitorClient";

export default async function MonitorPage() {
  await requireStudioUser("/studio/monitor");
  return (
    <StudioShell
      title=""
      breadcrumbs={[]}
    >
      <MonitorClient />
    </StudioShell>
  );
}
