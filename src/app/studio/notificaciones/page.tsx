import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import NotificacionesClient from "./NotificacionesClient";

export default async function NotificacionesPage() {
  await requireStudioUser("/studio/notificaciones");

  return (
    <StudioShell
      title="Notificaciones"
      description="Edita el texto, la hora y el estado de cada tipo de notificación. El móvil agenda los tipos activos localmente; los usuarios eligen cuáles reciben."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Notificaciones" },
      ]}
    >
      <NotificacionesClient />
    </StudioShell>
  );
}
