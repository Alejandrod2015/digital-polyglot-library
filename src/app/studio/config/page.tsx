import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import ConfigClient from "./ConfigClient";

export default async function ConfigPage() {
  await requireStudioUser("/studio/config");

  return (
    <StudioShell
      title="Reglas pedagógicas"
      description="Configura las reglas CEFR que los agentes usan para generar y validar contenido."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Reglas pedagógicas" },
      ]}
    >
      <ConfigClient />
    </StudioShell>
  );
}
