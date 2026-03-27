import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import QAClient from "./QAClient";

export default async function QAPage() {
  await requireStudioUser("/studio/qa");

  return (
    <StudioShell
      title="QA"
      description="Auditoría de la app: bugs, inconsistencias, seguridad, y UX."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "QA" },
      ]}
    >
      <QAClient />
    </StudioShell>
  );
}
