import StudioShell from "@/components/studio/StudioShell";
import ValidarPageClient from "@/components/studio/ValidarPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function ValidarPage() {
  await requireStudioUser("/studio/validar");

  return (
    <StudioShell
      title="Validar historia generada"
      description="Pega un JSON de historia del Custom GPT y mira si cumple el spec antes de subirla al journey."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Validar historia" },
      ]}
    >
      <ValidarPageClient />
    </StudioShell>
  );
}
