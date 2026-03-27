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
      title="Edit Journey Story"
      description="Keep Journey authoring inside App Studio while the current runtime still reads from the existing content layer."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Journey Stories", href: "/studio/journey-stories" },
        { label: "Edit Story" },
      ]}
    >
      <JourneyStoryEditorPageClient storyId={storyId} />
    </StudioShell>
  );
}
