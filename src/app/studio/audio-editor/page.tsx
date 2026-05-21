import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import AudioEditorClient from "./AudioEditorClient";

export const dynamic = "force-dynamic";

export default async function StudioAudioEditorPage() {
  await requireStudioUser("/studio/audio-editor");

  return (
    <StudioShell
      eyebrow="Multimedia"
      title="Audio Editor [BETA]"
      description="Selecciona el tramo problemático de una historia, regéneralo y splicéalo preservando el ambiente."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Audio Editor BETA" }]}
    >
      <AudioEditorClient />
    </StudioShell>
  );
}
