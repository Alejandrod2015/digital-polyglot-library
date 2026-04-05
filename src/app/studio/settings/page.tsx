import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  await requireStudioUser("/studio/settings");
  return (
    <StudioShell
      title="Settings"
      description="Configura accesos y modo de prueba"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Settings" }]}
    >
      <SettingsClient />
    </StudioShell>
  );
}
