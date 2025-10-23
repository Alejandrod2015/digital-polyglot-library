import { PrismaClient } from "@/generated/prisma";
import Player from "@/components/Player";
import { notFound } from "next/navigation";

const prisma = new PrismaClient();

type StoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params;

  const story = await prisma.userStory.findUnique({
    where: { id },
  });

  if (!story) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-white pb-32">
      <h1 className="text-3xl font-bold mb-4">{story.title}</h1>

      <div className="text-sm text-gray-400 mb-6 space-x-4">
        <span>
          <strong>Language:</strong> {story.language}
        </span>
        <span>
          <strong>Level:</strong> {story.level}
        </span>
      </div>

      {/* Texto de la historia */}
      <div
        className="prose prose-invert max-w-none leading-relaxed text-lg mb-12"
        dangerouslySetInnerHTML={{ __html: story.text }}
      />

      {/* Audio */}
      {story.audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:ml-64">
          <Player
            src={`https://cdn.sanity.io/files/${story.audioUrl.replace(/^file-/, '').replace(/-mp3$/, '.mp3')}`}
            bookSlug="polyglot"
            storySlug={story.id}
          />
        </div>
      )}
    </div>
  );
}
