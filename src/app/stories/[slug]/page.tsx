import { PrismaClient } from "@/generated/prisma";
import Player from "@/components/Player";
import { notFound } from "next/navigation";
import StoryReaderClient from "./StoryReaderClient";

const prisma = new PrismaClient();

type StoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params;

  const story = await prisma.userStory.findUnique({
    where: { slug },
  });

  if (!story) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto p-8 text-white pb-32">
      <h1 className="text-3xl font-bold mb-4">{story.title}</h1>

      <div className="text-sm text-gray-400 mb-6 space-x-4">
        <span><strong>Language:</strong> {story.language}</span>
        <span><strong>Level:</strong> {story.level}</span>
      </div>

      <StoryReaderClient
        story={{
          id: story.id,
          title: story.title,
          text: story.text,
          vocab: (story.vocab as { word: string; definition: string }[]) ?? [],
          audioUrl: story.audioUrl ?? null,
          language: story.language ?? null,
          level: story.level ?? null,
          // para VocabPanel compat
          slug: story.slug,
        }}
      />

      {story.audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:ml-64">
          <Player
            src={story.audioUrl}
            bookSlug="polyglot"
            storySlug={story.slug}
          />
        </div>
      )}
    </div>
  );
}
