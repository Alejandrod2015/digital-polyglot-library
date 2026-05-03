import StudioShell from "@/components/studio/StudioShell";
import StudioAudioClient from "@/components/studio/StudioAudioClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function StudioAudioPage() {
  await requireStudioUser("/studio/audio");

  return (
    <StudioShell
      title="Audio local (Kokoro)"
      description="Genera narraciones MP3 localmente con Kokoro TTS y súbelas al CDN. Solo disponible en dev con LOCAL_TTS_ENABLED=1."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Audio local" },
      ]}
    >
      <StudioAudioClient />
    </StudioShell>
  );
}
