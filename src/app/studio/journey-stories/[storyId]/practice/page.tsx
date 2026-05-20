import StudioShell from "@/components/studio/StudioShell";
import PracticeSetEditor from "@/components/studio/PracticeSetEditor";
import { prisma } from "@/lib/prisma";
import { requireStudioUser } from "@/lib/requireStudioUser";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ storyId: string }>;
};

export default async function StoryPracticeSetPage({ params }: Props) {
  const { storyId } = await params;
  await requireStudioUser(`/studio/journey-stories/${encodeURIComponent(storyId)}/practice`);

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      slug: true,
      title: true,
      level: true,
      topic: true,
      journey: { select: { language: true } },
      practiceSet: {
        select: {
          id: true,
          locked: true,
          updatedAt: true,
          exercises: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              orderIndex: true,
              type: true,
              word: true,
              sentence: true,
              audioUrl: true,
              payload: true,
            },
          },
        },
      },
    },
  });
  if (!story) notFound();

  return (
    <StudioShell
      title="Ejercicios de práctica"
      description="Set persistido de ejercicios al terminar esta historia. Los users ven exactamente esto, en este orden."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Stories library", href: "/studio/journey-stories" },
        { label: story.title ?? story.slug ?? storyId, href: `/studio/journey-stories/${storyId}` },
        { label: "Práctica" },
      ]}
    >
      <PracticeSetEditor
        storyId={story.id}
        storyTitle={story.title ?? story.slug ?? storyId}
        language={story.journey?.language ?? ""}
        set={
          story.practiceSet
            ? {
                id: story.practiceSet.id,
                locked: story.practiceSet.locked,
                updatedAt: story.practiceSet.updatedAt.toISOString(),
                exercises: story.practiceSet.exercises.map((e) => ({
                  id: e.id,
                  orderIndex: e.orderIndex,
                  type: e.type,
                  word: e.word,
                  sentence: e.sentence,
                  audioUrl: e.audioUrl,
                  payload: e.payload as Record<string, unknown>,
                })),
              }
            : null
        }
      />
    </StudioShell>
  );
}
