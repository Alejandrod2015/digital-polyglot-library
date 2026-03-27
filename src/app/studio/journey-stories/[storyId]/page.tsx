import StudioShell from "@/components/studio/StudioShell";
import JourneyStoryEditorPageClient from "@/components/studio/JourneyStoryEditorPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

type JourneyStoryEditorPageProps = {
  params: Promise<{ storyId: string }>;
};

export default async function JourneyStoryEditorPage({
  params,
}: JourneyStoryEditorPageProps) {
  const { storyId } = await params;
  await requireStudioUser(`/studio/journey-stories/${encodeURIComponent(storyId)}`);

  return (
    <StudioShell
      title="Editar historia del Journey"
      description="Mantén la autoría del Journey dentro de Studio mientras el runtime sigue leyendo desde la capa actual de contenido."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Biblioteca de historias", href: "/studio/journey-stories" },
        { label: "Editar historia" },
      ]}
    >
      <JourneyStoryEditorPageClient storyId={storyId} />
    </StudioShell>
  );
}
