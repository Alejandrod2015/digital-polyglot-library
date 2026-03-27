import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronLeft, Sparkles } from "lucide-react";
import {
  buildJourneyTrackInsights,
  buildJourneyLevels,
  getJourneyTopicCompletedStoryCount,
  getJourneyTopicCheckpointKey,
  getJourneyTopicRequiredStoryCount,
  getJourneyTopicPracticeKey,
  getUnlockedStoryCount,
  isJourneyStoryComplete,
  isJourneyTopicComplete,
} from "../../journeyData";
import { formatVariantLabel, normalizeVariant } from "@/lib/languageVariant";
import { getJourneyFocusFromLearningGoal, getJourneyVariantFromPreferences, normalizeJourneyFocus } from "@/lib/onboarding";
import {
  getCompletedJourneyStoryKeys,
  getJourneyDueReviewItems,
  getPassedJourneyCheckpointKeys,
  getPracticedJourneyTopicKeys,
} from "@/lib/journeyProgress";
import StoryJourneyClient from "./StoryJourneyClient";
import JourneyMilestoneBanner from "./JourneyMilestoneBanner";

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
  searchParams: Promise<{
    variant?: string;
    justRead?: string;
    justPracticed?: string;
    justCheckpoint?: string;
  }>;
}) {
  const { levelId, topicId } = await params;
  const { variant, justRead, justPracticed, justCheckpoint } = await searchParams;
  const user = await currentUser();
  const preferredRegion =
    typeof user?.publicMetadata?.preferredRegion === "string"
      ? user.publicMetadata.preferredRegion
      : null;
  const preferredVariant =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? normalizeVariant(user.publicMetadata.preferredVariant)
      : null;
  const journeyFocus =
    typeof user?.publicMetadata?.journeyFocus === "string"
      ? normalizeJourneyFocus(user.publicMetadata.journeyFocus)
      : getJourneyFocusFromLearningGoal(
          typeof user?.publicMetadata?.learningGoal === "string" ? user.publicMetadata.learningGoal : null
        );
  const activeVariant =
    (typeof variant === "string" ? normalizeVariant(variant) : null) ??
    preferredVariant ??
    getJourneyVariantFromPreferences("Spanish", preferredVariant, preferredRegion) ??
    undefined;
  if (!variant && activeVariant) {
    redirect(`/journey/${levelId}/${topicId}?variant=${encodeURIComponent(activeVariant)}`);
  }
  const levels = await buildJourneyLevels(activeVariant, "Spanish", journeyFocus ?? "General");
  const level = levels.find((entry) => entry.id === levelId) ?? null;
  const topic = level?.topics.find((entry) => entry.slug === topicId) ?? null;
  const [completedStoryKeys, passedCheckpointKeys, practicedTopicKeys, dueReviewItems] = await Promise.all([
    getCompletedJourneyStoryKeys(),
    getPassedJourneyCheckpointKeys(),
    getPracticedJourneyTopicKeys(),
    getJourneyDueReviewItems(),
  ]);

  if (!level || !topic) {
    notFound();
  }

  const optimisticCompletedStoryKeys = new Set(completedStoryKeys);
  const optimisticPassedCheckpointKeys = new Set(passedCheckpointKeys);
  const optimisticPracticedTopicKeys = new Set(practicedTopicKeys);

  if (typeof justRead === "string" && justRead.trim()) {
    optimisticCompletedStoryKeys.add(justRead.trim());
  }

  const topicPracticeKey = getJourneyTopicPracticeKey(activeVariant, level.id, topic.slug);
  if (justPracticed === "1") {
    optimisticPracticedTopicKeys.add(topicPracticeKey);
  }

  const checkpointKey = getJourneyTopicCheckpointKey(
    activeVariant,
    level.id,
    topic.slug
  );
  if (justCheckpoint === "1") {
    optimisticPassedCheckpointKeys.add(checkpointKey);
  }

  const unlockedStoryCount = getUnlockedStoryCount(topic, optimisticCompletedStoryKeys);
  const topicCompleted = isJourneyTopicComplete(topic, optimisticCompletedStoryKeys);
  const checkpointPassed = optimisticPassedCheckpointKeys.has(
    checkpointKey
  );
  const topicPracticed = optimisticPracticedTopicKeys.has(topicPracticeKey);
  const completedStoryCount = getJourneyTopicCompletedStoryCount(topic, optimisticCompletedStoryKeys);
  const requiredStoryCount = getJourneyTopicRequiredStoryCount(topic);
  const remainingRequiredStories = Math.max(0, requiredStoryCount - completedStoryCount);
  const dueReviewProgressKeySet = new Set(
    dueReviewItems.map((item) => item.progressKey).filter((value): value is string => Boolean(value))
  );
  const topicDueReviewCount = topic.stories.reduce((sum, story) => {
    return sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0);
  }, 0);
  const trackInsights = buildJourneyTrackInsights(
    { id: activeVariant ?? "default", levels },
    optimisticCompletedStoryKeys,
    optimisticPracticedTopicKeys,
    optimisticPassedCheckpointKeys,
    dueReviewItems
  );

  const returnParams = new URLSearchParams();
  if (activeVariant) returnParams.set("variant", activeVariant);
  const returnTo = `/journey/${level.id}/${topic.slug}${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;
  const returnLabel = topic.label;
  const practiceReturnParams = new URLSearchParams(returnParams);
  practiceReturnParams.set("justPracticed", "1");
  const practiceReturnHref = `/journey/${level.id}/${topic.slug}?${practiceReturnParams.toString()}`;
  const checkpointReturnParams = new URLSearchParams(returnParams);
  checkpointReturnParams.set("justCheckpoint", "1");
  const checkpointReturnHref = `/journey/${level.id}/${topic.slug}?${checkpointReturnParams.toString()}`;
  const topicPracticeParams = new URLSearchParams();
  topicPracticeParams.set("source", "journey");
  topicPracticeParams.set("levelId", level.id);
  topicPracticeParams.set("topicId", topic.slug);
  if (activeVariant) topicPracticeParams.set("variant", activeVariant);
  topicPracticeParams.set("returnTo", practiceReturnHref);
  topicPracticeParams.set("returnLabel", topic.label);
  const topicPracticeHref = `/practice?${topicPracticeParams.toString()}`;
  const checkpointHrefParams = new URLSearchParams();
  if (activeVariant) checkpointHrefParams.set("variant", activeVariant);
  checkpointHrefParams.set("returnTo", checkpointReturnHref);
  const checkpointHref = `/journey/${level.id}/${topic.slug}/checkpoint?${checkpointHrefParams.toString()}`;
  const currentTopicIndex = level.topics.findIndex((entry) => entry.slug === topic.slug);
  const nextTopic = currentTopicIndex >= 0
    ? level.topics.slice(currentTopicIndex + 1).find((entry) => entry.storyCount > 0) ?? null
    : null;
  const nextUnlockedStory = topic.stories.find((story, index) => {
    const isUnlocked = index < unlockedStoryCount;
    return isUnlocked && !isJourneyStoryComplete(story, optimisticCompletedStoryKeys);
  }) ?? null;
  const nextTopicHref =
    nextTopic
      ? `/journey/${level.id}/${nextTopic.slug}${activeVariant ? `?variant=${encodeURIComponent(activeVariant)}` : ""}`
      : null;
  const currentLevelIndex = levels.findIndex((entry) => entry.id === level.id);
  const nextUnlockedLevel =
    currentLevelIndex >= 0
      ? levels.slice(currentLevelIndex + 1).find((entry) => entry.topics.some((topic) => topic.storyCount > 0)) ?? null
      : null;
  const nextUnlockedLevelHref =
    nextUnlockedLevel
      ? `/journey${activeVariant ? `?variant=${encodeURIComponent(activeVariant)}` : ""}`
      : null;
  const primaryAction = nextUnlockedStory
    ? {
        href: `${nextUnlockedStory.href}?returnTo=${encodeURIComponent(
          `/journey/${level.id}/${topic.slug}?${new URLSearchParams(
            activeVariant ? { variant: activeVariant, justRead: nextUnlockedStory.progressKey } : { justRead: nextUnlockedStory.progressKey }
          ).toString()}`
        )}&returnLabel=${encodeURIComponent(returnLabel)}`,
        label: nextUnlockedStory.title,
        cta: "Continue story",
        tone:
          "inline-flex rounded-full border border-lime-200/20 bg-lime-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-lime-100 hover:bg-lime-300/16",
        description: "Pick up the next unlocked story and keep the topic moving.",
      }
    : topicDueReviewCount > 0
      ? {
          href: topicPracticeHref,
          label: "Review due",
          cta: "Start review",
          tone:
            "inline-flex rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100 hover:bg-amber-300/16",
          description: `You have ${topicDueReviewCount} due ${topicDueReviewCount === 1 ? "review item" : "review items"} in this topic.`,
        }
      : !topicPracticed
        ? {
            href: topicPracticeHref,
            label: "Practice topic",
            cta: "Open practice",
            tone:
              "inline-flex rounded-full border border-sky-200/20 bg-sky-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-100 hover:bg-sky-300/16",
            description: "You finished the reading. Lock it in with a focused practice pass.",
          }
        : !checkpointPassed
          ? {
              href: checkpointHref,
              label: "Take checkpoint",
              cta: "Start checkpoint",
              tone:
                "inline-flex rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100 hover:bg-amber-300/16",
              description: "Pass the checkpoint to unlock the next step in the journey.",
            }
          : nextTopicHref
            ? {
                href: nextTopicHref,
                label: "Next topic",
                cta: "Open next topic",
                tone:
                  "inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100 hover:bg-emerald-300/16",
                description: `Move on to ${nextTopic?.label ?? "the next topic"}.`,
              }
            : null;

  const storyNodes = topic.stories.map((story, index) => {
    const isUnlocked = index < unlockedStoryCount;
    const isCompleted = isJourneyStoryComplete(story, optimisticCompletedStoryKeys);
    const storyReturnParams = new URLSearchParams(returnParams);
    storyReturnParams.set("justRead", story.progressKey);
    const storyReturnHref = `/journey/${level.id}/${topic.slug}?${storyReturnParams.toString()}`;
    const storyHref = `${story.href}?returnTo=${encodeURIComponent(storyReturnHref)}&returnLabel=${encodeURIComponent(returnLabel)}`;

    return {
      kind: "story" as const,
      id: story.id,
      title: story.title,
      href: isUnlocked ? storyHref : undefined,
      coverUrl: story.coverUrl,
      label: `Story ${index + 1}`,
      meta: isUnlocked ? story.region ?? story.language ?? "Global" : "Unlock later",
      badge: isCompleted ? "Read" : index === 0 ? "Start" : index === unlockedStoryCount - 1 ? "Continue" : "Locked",
      badgeTone: isCompleted ? ("emerald" as const) : index === 0 ? ("lime" as const) : index === unlockedStoryCount - 1 ? ("sky" as const) : ("slate" as const),
      unlocked: isUnlocked,
    };
  });

  const finalNode = topicCompleted && !topicPracticed
    ? {
        kind: "final" as const,
        id: `${topic.slug}-practice`,
        href: topicPracticeHref,
        badge: "Practice topic",
        badgeTone: "sky" as const,
        unlocked: true,
        icon: "sparkles" as const,
      }
    : topicCompleted && !checkpointPassed
    ? {
        kind: "final" as const,
        id: `${topic.slug}-checkpoint`,
        href: checkpointHref,
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

  const milestoneCard =
    justCheckpoint === "1" && checkpointPassed
      ? nextTopic && nextTopicHref
        ? {
            eyebrow: "Unlocked",
            title: "Checkpoint cleared",
            body: `${nextTopic.label} is now open. Keep the journey moving while the momentum is fresh.`,
            cta: "Open next topic",
            href: nextTopicHref,
          }
        : nextUnlockedLevel && nextUnlockedLevelHref
          ? {
              eyebrow: "Level unlocked",
              title: `${nextUnlockedLevel.title} is open`,
              body: `You cleared ${topic.label}. The next level is ready when you are.`,
              cta: "Back to map",
              href: nextUnlockedLevelHref,
            }
          : {
              eyebrow: "Completed",
              title: "Checkpoint cleared",
              body: `${topic.label} is fully cleared.`,
              cta: "Back to topics",
              href: activeVariant ? `/journey?variant=${encodeURIComponent(activeVariant)}` : "/journey",
            }
      : justPracticed === "1" && topicPracticed
        ? {
            eyebrow: "Locked in",
            title: "Practice complete",
            body: checkpointPassed
              ? `${topic.label} is already cleared. You can move on whenever you want.`
              : `${topic.label} is now ready for its checkpoint.`,
            cta: checkpointPassed ? "Back to topics" : "Start checkpoint",
            href: checkpointPassed
              ? activeVariant
                ? `/journey?variant=${encodeURIComponent(activeVariant)}`
                : "/journey"
              : checkpointHref,
          }
        : typeof justRead === "string" && justRead.trim() && topicCompleted && !topicPracticed
          ? {
              eyebrow: "Stories cleared",
              title: "Topic reading complete",
              body: `You finished the required stories for ${topic.label}. Practice is the next unlock step.`,
              cta: "Open practice",
              href: topicPracticeHref,
            }
          : null;

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
        {milestoneCard ? <JourneyMilestoneBanner {...milestoneCard} /> : null}

        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-100/75">Journey score</p>
            <div className="mt-1 flex items-end gap-3">
              <p className="text-3xl font-black leading-none tracking-tight text-white">{trackInsights.score}</p>
              <p className="pb-0.5 text-sm text-slate-300/80">
                {trackInsights.completedSteps}/{trackInsights.totalSteps} steps
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#bef264,#38bdf8)]"
                style={{ width: `${Math.max(6, trackInsights.score)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-300/80">Next milestone: {trackInsights.nextMilestone}</p>
          </div>
          <div className="rounded-[1.35rem] border border-amber-200/10 bg-amber-300/5 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/80">Review lane</p>
            <p className="mt-1 text-base font-black tracking-tight text-white">
              {topicDueReviewCount > 0
                ? `${topicDueReviewCount} due in this topic`
                : trackInsights.dueReviewCount > 0
                  ? `${trackInsights.dueReviewCount} due across the track`
                  : "No due review right now"}
            </p>
            <p className="mt-2 text-sm text-slate-300/80">
              {topicDueReviewCount > 0
                ? "Clear these review items before they pile up and slow the lane down."
                : trackInsights.dueReviewCount > 0
                  ? "This topic is clear, but other topics need review to keep the path warm."
                  : "Perfect moment to keep moving forward with fresh stories."}
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-100/70">{level.subtitle}</p>
            <h2 className="mt-0.5 text-base font-black tracking-tight text-white sm:text-3xl">Story journey</h2>
          </div>
          <div className="flex items-center gap-2">
            {primaryAction ? (
              <div className="flex items-center gap-2">
                <div className="hidden max-w-[16rem] text-right md:block">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-100/75">Next action</p>
                  <p className="mt-1 text-sm font-semibold text-white">{primaryAction.label}</p>
                  <p className="mt-1 text-xs text-slate-300/80">{primaryAction.description}</p>
                </div>
                <Link href={primaryAction.href} className={primaryAction.tone}>
                  {primaryAction.cta}
                </Link>
              </div>
            ) : !topicCompleted ? (
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/80">
                Finish {remainingRequiredStories} more {remainingRequiredStories === 1 ? "story" : "stories"}
              </div>
            ) : (
              <div className="inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-100">
                Topic cleared
              </div>
            )}
            <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/80">
              {topic.storyCount} stories
            </div>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${completedStoryCount > 0 ? "border-emerald-200/20 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-200/80"}`}>
            Read: {Math.min(completedStoryCount, requiredStoryCount)}/{requiredStoryCount} required
          </div>
          {topic.storyCount > requiredStoryCount ? (
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/80">
              {topic.storyCount - requiredStoryCount} extra {topic.storyCount - requiredStoryCount === 1 ? "story" : "stories"}
            </div>
          ) : null}
          <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${topicPracticed ? "border-sky-200/20 bg-sky-300/10 text-sky-100" : "border-white/10 bg-white/5 text-slate-200/80"}`}>
            {topicPracticed ? "Practiced" : "Practice pending"}
          </div>
          <div className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${checkpointPassed ? "border-amber-200/20 bg-amber-300/10 text-amber-100" : "border-white/10 bg-white/5 text-slate-200/80"}`}>
            {checkpointPassed ? "Checkpoint cleared" : "Checkpoint pending"}
          </div>
        </div>

        <StoryJourneyClient nodes={[...storyNodes, finalNode]} />
      </section>
    </div>
  );
}
