import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import DraftsClient from "./DraftsClient";

export default async function DraftsPage() {
  await requireStudioUser("/studio/drafts");
  return (
    <StudioShell
      title="Borradores"
      description="Revisa, edita y aprueba los borradores generados por los agents."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Borradores" }]}
    >
      <DraftsClient />
    </StudioShell>
  );
}
