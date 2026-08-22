import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import NotificacionesClient from "./NotificacionesClient";

export default async function NotificacionesPage() {
  await requireStudioUser("/studio/notificaciones");

  return (
    <StudioShell
      title="Notificaciones"
      description="El plan de avisos inteligentes, el texto y la hora de cada tipo, las campañas push y su efectividad. El móvil agenda los tipos activos localmente; los usuarios eligen cuáles reciben."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Notificaciones" },
      ]}
    >
      <NotificacionesClient />
    </StudioShell>
  );
}
