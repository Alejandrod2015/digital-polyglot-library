import { PrismaClient } from "@/generated/prisma";
import Player from "@/components/Player";
import { notFound } from "next/navigation";
import StoryReaderClient from "./StoryReaderClient";
import { currentUser } from "@clerk/nextjs/server";
import { getFeaturedStory } from "@/lib/getFeaturedStory";

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

  const user = await currentUser();
  const plan =
    (user?.publicMetadata?.plan as
      | "free"
      | "basic"
      | "premium"
      | "polyglot"
      | "owner") || "free";

  const weeklyStory = await getFeaturedStory("week");
  const dailyStory = await getFeaturedStory("day");

  const isWeeklyStory = weeklyStory?.slug === story.slug;
  const isDailyStory = dailyStory?.slug === story.slug;

  const hasFullAccess =
    plan === "premium" ||
    plan === "polyglot" ||
    plan === "owner" ||
    (plan === "basic" && (isWeeklyStory || isDailyStory)) ||
    (plan === "free" && isWeeklyStory);

  // 🧩 Si no tiene acceso completo, truncar texto
  const displayText = hasFullAccess
    ? story.text
    : `${story.text.slice(0, 1000)}…`;

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

      {/* 🧩 Mostrar texto truncado si no hay acceso */}
      <div className="relative">
        <StoryReaderClient
          story={{
            id: story.id,
            title: story.title,
            text: displayText,
            vocab:
              (story.vocab as { word: string; definition: string }[]) ?? [],
            audioUrl: story.audioUrl ?? null,
            language: story.language ?? null,
            level: story.level ?? null,
            slug: story.slug,
          }}
        />

        {/* 🧩 Mostrar degradado + botón si no tiene acceso */}
        {!hasFullAccess && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A]/90 to-transparent z-10" />
            <div className="absolute inset-x-0 bottom-[-8rem] flex flex-col items-center justify-end pb-12 text-center z-20">
              <p className="text-gray-200 text-xl sm:text-xl mb-3 drop-shadow">
                Unlock full access to all stories.
              </p>
              <a
                href="/plans"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-medium font-medium rounded-xl shadow-lg transition"
              >
                Upgrade
              </a>
            </div>
          </>
        )}
      </div>

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
