import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import {
  buildJourneyLevels,
  getJourneyTopicCheckpointKey,
  getUnlockedStoryCount,
  isJourneyStoryComplete,
  isJourneyTopicComplete,
} from "../../journeyData";
import { formatVariantLabel, normalizeVariant } from "@/lib/languageVariant";
import { getCompletedJourneyStoryKeys, getPassedJourneyCheckpointKeys } from "@/lib/journeyProgress";
import StoryJourneyClient from "./StoryJourneyClient";

export async function generateStaticParams() {
  const levels = await buildJourneyLevels();
  return levels.flatMap((level) =>
    level.topics.map((topic) => ({
      levelId: level.id,
      topicId: topic.slug,
    }))
  );
}

export default async function JourneyTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ levelId: string; topicId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { levelId, topicId } = await params;
  const { variant } = await searchParams;
  const user = await currentUser();
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const activeVariant =
    (typeof variant === "string" ? normalizeVariant(variant) : null) ?? preferredVariant ?? undefined;
  if (!variant && activeVariant) {
    redirect(`/journey/${levelId}/${topicId}?variant=${encodeURIComponent(activeVariant)}`);
  }
  const levels = await buildJourneyLevels(activeVariant);
  const level = levels.find((entry) => entry.id === levelId) ?? null;
  const topic = level?.topics.find((entry) => entry.slug === topicId) ?? null;
  const [completedStoryKeys, passedCheckpointKeys] = await Promise.all([
    getCompletedJourneyStoryKeys(),
    getPassedJourneyCheckpointKeys(),
  ]);

  if (!level || !topic) {
    notFound();
  }

  const unlockedStoryCount = getUnlockedStoryCount(topic, completedStoryKeys);
  const topicCompleted = isJourneyTopicComplete(topic, completedStoryKeys);
  const checkpointPassed = passedCheckpointKeys.has(
    getJourneyTopicCheckpointKey(
      activeVariant,
      level.id,
      topic.slug
    )
  );

  const returnTo = activeVariant
    ? `/journey/${level.id}/${topic.slug}?variant=${encodeURIComponent(activeVariant)}`
    : `/journey/${level.id}/${topic.slug}`;
  const returnLabel = topic.label;
  const storyNodes = topic.stories.map((story, index) => {
    const isUnlocked = index < unlockedStoryCount;
    const isCompleted = isJourneyStoryComplete(story, completedStoryKeys);
    const storyHref = `${story.href}?returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`;

    return {
      kind: "story" as const,
      id: story.id,
      title: story.title,
      href: isUnlocked ? storyHref : undefined,
      coverUrl: story.coverUrl,
      label: `Story ${index + 1}`,
      meta: isUnlocked ? story.region ?? story.language ?? "Global" : "Unlock later",
      badge: isCompleted ? "Completed" : index === 0 ? "Start" : index === unlockedStoryCount - 1 ? "Continue" : "Locked",
      badgeTone: isCompleted ? ("emerald" as const) : index === 0 ? ("lime" as const) : index === unlockedStoryCount - 1 ? ("sky" as const) : ("slate" as const),
      unlocked: isUnlocked,
    };
  });

  const finalNode = topicCompleted && !checkpointPassed
    ? {
        kind: "final" as const,
        id: `${topic.slug}-checkpoint`,
        href: `/journey/${level.id}/${topic.slug}/checkpoint${activeVariant ? `?variant=${encodeURIComponent(activeVariant)}` : ""}`,
        badge: "Checkpoint",
        badgeTone: "amber" as const,
        unlocked: true,
        icon: "sparkles" as const,
      }
    : !topicCompleted
      ? {
          kind: "final" as const,
          id: `${topic.slug}-finish`,
          badge: "Finish this journey",
          badgeTone: "slate" as const,
          unlocked: false,
          icon: "sparkles" as const,
        }
      : {
          kind: "final" as const,
          id: `${topic.slug}-cleared`,
          badge: "Journey cleared",
          badgeTone: "emerald" as const,
          unlocked: false,
          icon: "sparkles" as const,
        };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-14 pt-4 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.10),transparent_18%),linear-gradient(180deg,#0a2b56_0%,#08264d_48%,#071f43_100%)] px-4 py-2 sm:rounded-[2rem] sm:px-5 sm:py-3">
        <div className="flex flex-col gap-1">
          <Link
            href={activeVariant ? `/journey?variant=${encodeURIComponent(activeVariant)}` : "/journey"}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/88 hover:bg-white/10"
          >
            <ChevronLeft size={16} />
            Back to topics
          </Link>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200/20 bg-sky-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100 sm:text-[11px]">
                <Sparkles size={14} />
                {level.title} {formatVariantLabel(activeVariant) ?? "story"} journey
              </div>
              <h1 className="text-[1.42rem] font-black leading-none tracking-tight text-white sm:text-5xl">
                {topic.label}
              </h1>
            </div>
            <div className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/80">
              {topic.storyCount}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,45,82,0.96),rgba(11,31,61,0.98))] px-2.5 py-3 shadow-[0_20px_50px_rgba(2,10,26,0.28)] sm:px-5 sm:py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-100/70">{level.subtitle}</p>
            <h2 className="mt-0.5 text-base font-black tracking-tight text-white sm:text-3xl">Story journey</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/practice?source=journey&levelId=${encodeURIComponent(level.id)}&topicId=${encodeURIComponent(
                topic.slug
              )}${activeVariant ? `&variant=${encodeURIComponent(activeVariant)}` : ""}`}
              className="inline-flex rounded-full border border-sky-200/20 bg-sky-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100 hover:bg-sky-300/16"
            >
              Practice topic
            </Link>
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/80">
              {topic.storyCount} stories
            </div>
          </div>
        </div>

        <StoryJourneyClient nodes={[...storyNodes, finalNode]} />
      </section>
    </div>
  );
}
