import StudioShell from "@/components/studio/StudioShell";
import ValidarPageClient from "@/components/studio/ValidarPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function ValidarPage() {
  await requireStudioUser("/studio/validar");

  return (
    <StudioShell
      title="Validar y subir historia"
      description="Pega el JSON que generó Claude (/generate-story), elige journey · nivel · tema, valida; si pasa, un clic sube la historia al Studio."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Planteamiento" },
        { label: "Validar historia" },
      ]}
    >
      <ValidarPageClient />
    </StudioShell>
  );
}
