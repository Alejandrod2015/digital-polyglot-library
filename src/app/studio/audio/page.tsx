import StudioShell from "@/components/studio/StudioShell";
import StudioAudioClient from "@/components/studio/StudioAudioClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function StudioAudioPage() {
  await requireStudioUser("/studio/audio");

  return (
    <StudioShell
      title="Audio propio"
      description="Genera narraciones MP3 con nuestros motores de voz y súbelas al CDN."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Audio propio" },
      ]}
    >
      <StudioAudioClient />
    </StudioShell>
  );
}
