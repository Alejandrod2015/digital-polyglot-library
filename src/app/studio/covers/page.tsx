import StudioShell from "@/components/studio/StudioShell";
import StudioCoversClient from "./StudioCoversClient";

export default function StudioCoversPage() {
  return (
    <StudioShell
      eyebrow="Generación de imágenes"
      title="Covers"
      description="Genera 3 variantes de cover en paralelo para una historia y elegí la que mejor encaje. Cada generación cuesta ~$0.15-0.30 en Flux Pro (3 imágenes)."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Covers" }]}
    >
      <StudioCoversClient />
    </StudioShell>
  );
}
