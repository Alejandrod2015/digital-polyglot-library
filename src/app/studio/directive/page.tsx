import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import DirectiveClient from "./DirectiveClient";

export default async function DirectivePage() {
  await requireStudioUser("/studio/directive");

  return (
    <StudioShell
      title="Directriz de contenido"
      description="Define la visión y los parámetros que guían la generación automática de contenido."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Directriz de contenido" },
      ]}
    >
      <DirectiveClient />
    </StudioShell>
  );
}
