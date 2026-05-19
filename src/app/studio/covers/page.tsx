import StudioShell from "@/components/studio/StudioShell";
import StudioCoversClient from "./StudioCoversClient";

export default function StudioCoversPage() {
  return (
    <StudioShell
      eyebrow="Generación de imágenes"
      title="Covers"
      description="Genera y gestiona la portada de cada historia."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Covers" }]}
    >
      <StudioCoversClient />
    </StudioShell>
  );
}
