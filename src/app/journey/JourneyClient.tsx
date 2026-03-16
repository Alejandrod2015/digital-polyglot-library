"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  BusFront,
  ChefHat,
  Flame,
  FerrisWheel,
  Goal,
  HeartHandshake,
  Leaf,
  Lightbulb,
  Lock,
  Map as MapIcon,
  RotateCcw,
  Sparkles,
  type LucideIcon,
  Store,
} from "lucide-react";
import {
  getJourneyTopicCheckpointKey,
  getJourneyTopicCompletedStoryCount,
  getJourneyTopicPracticeKey,
  getJourneyTopicRequiredStoryCount,
  getUnlockedLevelCount,
  getUnlockedTopicCount,
  isJourneyTopicComplete,
  type JourneyVariantTrack,
} from "./journeyData";
import type { JourneyDueReviewItem } from "@/lib/journeyProgress";

type JourneyClientProps = {
  tracks: JourneyVariantTrack[];
  initialVariantId: string;
  completedStoryKeys: string[];
  passedCheckpointKeys: string[];
  practicedTopicKeys: string[];
  dueReviewItems: JourneyDueReviewItem[];
};

type JourneyProgressSummary = {
  weeklyGoalStories: number;
  weeklyStoriesFinished: number;
  weeklyPracticeSessions: number;
  weeklyGoalPracticeSessions: number;
  storyStreakDays: number;
};

const topicVisuals: Array<{
  match: RegExp;
  icon: LucideIcon;
  node: string;
}> = [
  { match: /food|cook|cafe|restaurant|market/i, icon: ChefHat, node: "from-amber-300 to-lime-300 text-slate-950 shadow-[0_14px_30px_rgba(252,211,77,0.24)]" },
  { match: /travel|transport|station|city|place/i, icon: BusFront, node: "from-sky-300 to-cyan-300 text-slate-950 shadow-[0_14px_30px_rgba(125,211,252,0.22)]" },
  { match: /work|career|office|job/i, icon: BriefcaseBusiness, node: "from-rose-300 to-orange-300 text-slate-950 shadow-[0_14px_30px_rgba(251,113,133,0.22)]" },
  { match: /family|community|relationship|love/i, icon: HeartHandshake, node: "from-fuchsia-300 to-pink-300 text-slate-950 shadow-[0_14px_30px_rgba(244,114,182,0.22)]" },
  { match: /nature|environment/i, icon: Leaf, node: "from-emerald-300 to-teal-300 text-slate-950 shadow-[0_14px_30px_rgba(110,231,183,0.22)]" },
  { match: /history|culture|tradition/i, icon: FerrisWheel, node: "from-violet-300 to-indigo-300 text-slate-950 shadow-[0_14px_30px_rgba(196,181,253,0.22)]" },
  { match: /shop|money/i, icon: Store, node: "from-cyan-300 to-sky-300 text-slate-950 shadow-[0_14px_30px_rgba(103,232,249,0.22)]" },
];

function getTopicVisual(label: string) {
  return (
    topicVisuals.find((visual) => visual.match.test(label)) ?? {
      icon: Lightbulb,
      node: "from-lime-300 to-emerald-300 text-slate-950 shadow-[0_14px_30px_rgba(163,230,53,0.22)]",
    }
  );
}

function renderTopicLabel(label: string) {
  const parts = label.split(" & ");
  if (parts.length === 2) {
    return (
      <>
        <span>{parts[0]} &</span>
        <span>{parts[1]}</span>
      </>
    );
  }

  return <span>{label}</span>;
}

export default function JourneyClient({
  tracks,
  initialVariantId,
  completedStoryKeys,
  passedCheckpointKeys,
  practicedTopicKeys,
  dueReviewItems,
}: JourneyClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstTrackId = tracks[0]?.id ?? "";
  const [selectedVariantId, setSelectedVariantId] = useState(
    tracks.some((track) => track.id === initialVariantId)
      ? initialVariantId
      : searchParams.get("variant") ?? firstTrackId
  );
  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === selectedVariantId) ?? tracks[0] ?? null,
    [selectedVariantId, tracks]
  );
  const levels = useMemo(() => selectedTrack?.levels ?? [], [selectedTrack]);
  const completedStoryKeySet = useMemo(() => new Set(completedStoryKeys), [completedStoryKeys]);
  const passedCheckpointKeySet = useMemo(
    () => new Set(passedCheckpointKeys),
    [passedCheckpointKeys]
  );
  const practicedTopicKeySet = useMemo(
    () => new Set(practicedTopicKeys),
    [practicedTopicKeys]
  );
  const dueReviewProgressKeySet = useMemo(
    () => new Set(dueReviewItems.map((item) => item.progressKey).filter((value): value is string => Boolean(value))),
    [dueReviewItems]
  );
  const unlockedLevelCount = useMemo(
    () =>
      getUnlockedLevelCount(
        levels,
        completedStoryKeySet,
        passedCheckpointKeySet,
        selectedTrack?.id
      ),
    [completedStoryKeySet, levels, passedCheckpointKeySet, selectedTrack]
  );
  const firstUnlockedLevelId = levels[Math.max(0, unlockedLevelCount - 1)]?.id ?? levels[0]?.id ?? "";
  const [selectedLevelId, setSelectedLevelId] = useState(firstUnlockedLevelId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [connectorFrame, setConnectorFrame] = useState({ width: 0, height: 0 });
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);
  const [progressSummary, setProgressSummary] = useState<JourneyProgressSummary | null>(null);
  const trackJourneyMetric = async (
    eventType:
      | "journey_variant_selected"
      | "journey_level_selected"
      | "journey_topic_opened"
      | "journey_next_action_clicked"
      | "journey_review_cta_clicked",
    metadata?: Record<string, unknown>,
    storySlug = "journey"
  ) => {
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookSlug: "journey",
          storySlug,
          eventType,
          metadata,
        }),
      });
    } catch {
      // Best-effort analytics only.
    }
  };
  const selectedLevel = useMemo(() => {
    const unlockedIds = new Set(levels.slice(0, unlockedLevelCount).map((level) => level.id));
    if (unlockedIds.has(selectedLevelId)) {
      return levels.find((level) => level.id === selectedLevelId) ?? levels[0] ?? null;
    }
    return levels.find((level) => level.id === firstUnlockedLevelId) ?? levels[0] ?? null;
  }, [firstUnlockedLevelId, levels, selectedLevelId, unlockedLevelCount]);

  useEffect(() => {
    const nextVariantId =
      (tracks.some((track) => track.id === initialVariantId) ? initialVariantId : searchParams.get("variant")) ??
      firstTrackId;
    if (nextVariantId && nextVariantId !== selectedVariantId) {
      setSelectedVariantId(nextVariantId);
    }
  }, [firstTrackId, initialVariantId, searchParams, selectedVariantId, tracks]);

  useEffect(() => {
    if (!selectedVariantId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("variant") === selectedVariantId) return;
    params.set("variant", selectedVariantId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedVariantId]);

  useEffect(() => {
    setSelectedLevelId(firstUnlockedLevelId);
  }, [firstUnlockedLevelId]);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<JourneyProgressSummary>;
        if (cancelled) return;
        if (
          typeof data.weeklyGoalStories === "number" &&
          typeof data.weeklyStoriesFinished === "number" &&
          typeof data.weeklyPracticeSessions === "number" &&
          typeof data.weeklyGoalPracticeSessions === "number" &&
          typeof data.storyStreakDays === "number"
        ) {
          setProgressSummary({
            weeklyGoalStories: data.weeklyGoalStories,
            weeklyStoriesFinished: data.weeklyStoriesFinished,
            weeklyPracticeSessions: data.weeklyPracticeSessions,
            weeklyGoalPracticeSessions: data.weeklyGoalPracticeSessions,
            storyStreakDays: data.storyStreakDays,
          });
        }
      } catch {
        // Keep the journey usable even if progress metrics are unavailable.
      }
    };

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedLevel) return;

    const measureConnectors = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const nextPaths: string[] = [];

      for (let index = 0; index < selectedLevel.topics.length - 1; index += 1) {
        const current = nodeRefs.current[index];
        const next = nodeRefs.current[index + 1];
        if (!current || !next) continue;

        const currentRect = current.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        const goingRight = nextRect.left > currentRect.left;
        const startX = goingRight
          ? currentRect.right - containerRect.left - 3
          : currentRect.left - containerRect.left + 3;
        const endX = goingRight
          ? nextRect.left - containerRect.left + 3
          : nextRect.right - containerRect.left - 3;
        const startY =
          currentRect.top -
          containerRect.top +
          currentRect.height * (goingRight ? 0.36 : 0.68);
        const endY =
          nextRect.top -
          containerRect.top +
          nextRect.height * (goingRight ? 0.3 : 0.62);
        const horizontalGap = Math.abs(endX - startX);
        const controlOffset = Math.max(28, horizontalGap * 0.42);
        const exitX = goingRight ? startX + controlOffset : startX - controlOffset;
        const entryX = goingRight ? endX - controlOffset : endX + controlOffset;

        nextPaths.push(
          `M ${startX} ${startY} C ${exitX} ${startY}, ${entryX} ${endY}, ${endX} ${endY}`
        );
      }

      setConnectorFrame({ width: containerRect.width, height: containerRect.height });
      setConnectorPaths(nextPaths);
    };

    measureConnectors();
    const frameId = window.requestAnimationFrame(measureConnectors);
    window.addEventListener("resize", measureConnectors);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measureConnectors);
    };
  }, [selectedLevel]);

  const unlockedTopicCount = getUnlockedTopicCount(
    selectedLevel ?? { id: "", title: "", topics: [] },
    completedStoryKeySet,
    passedCheckpointKeySet,
    selectedTrack?.id ?? "",
    selectedLevel?.id ?? ""
  );
  const laneOffsets = [8, 60, 12, 64, 16, 60];
  const dueReviewCountByTopicId = useMemo(() => {
    const counts = new Map<string, number>();

    if (!selectedTrack) {
      return counts;
    }

    for (const level of selectedTrack.levels) {
      for (const topic of level.topics) {
        const topicDueCount = topic.stories.reduce((sum, story) => {
          return sum + (dueReviewProgressKeySet.has(story.progressKey) ? 1 : 0);
        }, 0);
        if (topicDueCount > 0) {
          counts.set(`${level.id}:${topic.slug}`, topicDueCount);
        }
      }
    }

    return counts;
  }, [dueReviewProgressKeySet, selectedTrack]);
  const nextAction = useMemo(() => {
    if (!selectedLevel || !selectedTrack) return null;

    const currentTopicIndex = Math.max(0, unlockedTopicCount - 1);
    const currentTopic = selectedLevel.topics[currentTopicIndex] ?? selectedLevel.topics[0] ?? null;
    if (!currentTopic) return null;

    const topicHref = `/journey/${selectedLevel.id}/${currentTopic.slug}?variant=${encodeURIComponent(selectedTrack.id)}`;
    const completedCount = getJourneyTopicCompletedStoryCount(currentTopic, completedStoryKeySet);
    const requiredCount = getJourneyTopicRequiredStoryCount(currentTopic);
    const topicComplete = isJourneyTopicComplete(currentTopic, completedStoryKeySet);
    const practiceKey = getJourneyTopicPracticeKey(selectedTrack.id, selectedLevel.id, currentTopic.slug);
    const checkpointKey = getJourneyTopicCheckpointKey(selectedTrack.id, selectedLevel.id, currentTopic.slug);
    const practiced = practicedTopicKeySet.has(practiceKey);
    const checkpointPassed = passedCheckpointKeySet.has(checkpointKey);

    if (!topicComplete) {
      return {
        eyebrow: `${selectedLevel.title} in progress`,
        title: currentTopic.label,
        description:
          completedCount === 0
            ? "Start this topic and unlock the rest of the path."
            : `Read ${Math.max(0, requiredCount - completedCount)} more ${Math.max(0, requiredCount - completedCount) === 1 ? "story" : "stories"} to finish this topic.`,
        href: topicHref,
        label: completedCount === 0 ? "Start topic" : "Continue topic",
      };
    }

    if (!practiced) {
      return {
        eyebrow: `${selectedLevel.title} ready to reinforce`,
        title: currentTopic.label,
        description: "You finished the reading target. Practice the topic while it is still fresh.",
        href: topicHref,
        label: "Practice topic",
      };
    }

    if (!checkpointPassed) {
      return {
        eyebrow: `${selectedLevel.title} checkpoint`,
        title: currentTopic.label,
        description: "Clear the checkpoint to unlock the next topic in this level.",
        href: topicHref,
        label: "Take checkpoint",
      };
    }

    const nextTopic = selectedLevel.topics[currentTopicIndex + 1] ?? null;
    if (nextTopic) {
      return {
        eyebrow: `${selectedLevel.title} unlocked`,
        title: nextTopic.label,
        description: "Your next topic is open. Keep the journey moving.",
        href: `/journey/${selectedLevel.id}/${nextTopic.slug}?variant=${encodeURIComponent(selectedTrack.id)}`,
        label: "Open next topic",
      };
    }

    return {
      eyebrow: `${selectedLevel.title} cleared`,
      title: "Level complete",
      description: "You cleared every topic available in this level.",
      href: topicHref,
      label: "Review level",
    };
  }, [
    completedStoryKeySet,
    passedCheckpointKeySet,
    practicedTopicKeySet,
    selectedLevel,
    selectedTrack,
    unlockedTopicCount,
  ]);
  const reviewAction = useMemo(() => {
    if (!selectedTrack) return null;

    let best:
      | {
          levelId: string;
          topicSlug: string;
          topicLabel: string;
          dueCount: number;
        }
      | null = null;

    for (const level of selectedTrack.levels) {
      for (const topic of level.topics) {
        const dueCount = dueReviewCountByTopicId.get(`${level.id}:${topic.slug}`) ?? 0;
        if (dueCount === 0) continue;
        if (!best || dueCount > best.dueCount) {
          best = {
            levelId: level.id,
            topicSlug: topic.slug,
            topicLabel: topic.label,
            dueCount,
          };
        }
      }
    }

    if (!best) return null;

    const params = new URLSearchParams();
    params.set("source", "journey");
    params.set("levelId", best.levelId);
    params.set("topicId", best.topicSlug);
    params.set("variant", selectedTrack.id);
    params.set("review", "1");
    params.set("returnTo", `/journey?variant=${encodeURIComponent(selectedTrack.id)}`);
    params.set("returnLabel", "Back to journey");

    return {
      ...best,
      href: `/practice?${params.toString()}`,
    };
  }, [dueReviewCountByTopicId, selectedTrack]);
  const levelClearedTopicCount = useMemo(
    () => {
      if (!selectedLevel || !selectedTrack) return 0;

      return selectedLevel.topics.filter((topic) => {
        const checkpointKey = getJourneyTopicCheckpointKey(selectedTrack.id, selectedLevel.id, topic.slug);
        return (
          isJourneyTopicComplete(topic, completedStoryKeySet) &&
          passedCheckpointKeySet.has(checkpointKey)
        );
      }).length;
    },
    [completedStoryKeySet, passedCheckpointKeySet, selectedLevel, selectedTrack]
  );
  const levelCompletionPercent =
    (selectedLevel?.topics.length ?? 0) > 0
      ? Math.round((levelClearedTopicCount / (selectedLevel?.topics.length ?? 1)) * 100)
      : 0;
  const weeklyStoryPercent = progressSummary
    ? Math.min(
        100,
        Math.round((progressSummary.weeklyStoriesFinished / Math.max(progressSummary.weeklyGoalStories, 1)) * 100)
      )
    : 0;
  const weeklyPracticePercent = progressSummary
    ? Math.min(
        100,
        Math.round(
          (progressSummary.weeklyPracticeSessions / Math.max(progressSummary.weeklyGoalPracticeSessions, 1)) * 100
        )
      )
    : 0;

  if (!selectedLevel || !selectedTrack) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-14 pt-4 sm:gap-4 sm:px-6 lg:px-8">
      <section className="rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.08),transparent_18%),linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] px-4 py-2 sm:rounded-[1.75rem] sm:px-5 sm:py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="h-[11px]" />
          <div className="hidden items-center gap-2 sm:flex">
            <MapIcon size={18} className="text-lime-100/80" />
          </div>
        </div>

        <div className="mt-0.5">
          {tracks.length > 1 ? (
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex min-w-max gap-2">
                {tracks.map((track) => {
                  const active = track.id === selectedTrack.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(track.id);
                        void trackJourneyMetric("journey_variant_selected", {
                          variantId: track.id,
                          fromVariantId: selectedTrack.id,
                        });
                      }}
                      className={`rounded-full border px-2.5 py-0.5 text-[0.72rem] font-black uppercase tracking-[0.15em] transition sm:px-3 sm:py-1 sm:text-[0.8rem] ${
                        active
                          ? "border-lime-200/25 bg-lime-300 text-slate-950 shadow-[0_10px_24px_rgba(163,230,53,0.22)]"
                          : "border-white/10 bg-white/[0.04] text-lime-100/88 hover:bg-white/[0.08]"
                      }`}
                    >
                      {track.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <span className="inline-flex rounded-full border border-lime-200/18 bg-white/[0.04] px-2.5 py-0.5 text-[0.72rem] font-black uppercase tracking-[0.15em] text-lime-100/88 sm:px-3 sm:py-1 sm:text-[0.8rem]">
              {selectedTrack.label}
            </span>
          )}
        </div>

        <div className="-mx-1 mt-1.5 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
          {levels.map((level) => {
            const active = level.id === selectedLevel.id;
            const unlocked = levels.slice(0, unlockedLevelCount).some((entry) => entry.id === level.id);
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  if (!unlocked) return;
                  setSelectedLevelId(level.id);
                  void trackJourneyMetric("journey_level_selected", {
                    variantId: selectedTrack.id,
                    levelId: level.id,
                  });
                }}
                aria-disabled={!unlocked}
                className={`rounded-full border px-2.5 py-0.5 text-[0.82rem] font-black uppercase tracking-[0.08em] transition sm:px-4 sm:py-1.5 sm:text-sm ${
                  active
                    ? "border-lime-200/25 bg-lime-300 text-slate-950 shadow-[0_10px_24px_rgba(163,230,53,0.22)]"
                    : unlocked
                      ? "border-white/10 bg-white/5 text-white/82 hover:bg-white/10"
                      : "border-white/8 bg-white/[0.03] text-white/38"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {!unlocked ? <Lock size={12} /> : null}
                  {level.title}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {nextAction ? (
          <div className="mt-3 rounded-[1.25rem] border border-white/10 bg-white/[0.05] px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-100/72">
                  {nextAction.eyebrow}
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                  {nextAction.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-200/82">
                  {nextAction.description}
                </p>
              </div>
              <Link
                href={nextAction.href}
                onClick={() => {
                  void trackJourneyMetric("journey_next_action_clicked", {
                    variantId: selectedTrack.id,
                    levelId: selectedLevel.id,
                    actionLabel: nextAction.label,
                    actionTitle: nextAction.title,
                  });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-lime-200/25 bg-lime-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_10px_24px_rgba(163,230,53,0.22)] hover:brightness-105"
              >
                <Sparkles size={16} />
                {nextAction.label}
              </Link>
            </div>
          </div>
        ) : null}

        {reviewAction ? (
          <div className="mt-3 rounded-[1.25rem] border border-amber-200/18 bg-amber-300/[0.08] px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/78">
                  Review ready
                </p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                  {reviewAction.topicLabel}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-200/82">
                  You have {reviewAction.dueCount} due {reviewAction.dueCount === 1 ? "review item" : "review items"} in this topic. Jump back in before they fade.
                </p>
              </div>
              <Link
                href={reviewAction.href}
                onClick={() => {
                  void trackJourneyMetric(
                    "journey_review_cta_clicked",
                    {
                      variantId: selectedTrack.id,
                      levelId: reviewAction.levelId,
                      topicId: reviewAction.topicSlug,
                      dueCount: reviewAction.dueCount,
                    },
                    reviewAction.topicSlug
                  );
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/12 px-4 py-2.5 text-sm font-black text-amber-100 hover:bg-amber-300/18"
              >
                <RotateCcw size={16} />
                Review now
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-100/74">
              <Goal size={14} />
              {selectedLevel.title} progress
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-white">
              {levelClearedTopicCount}/{selectedLevel.topics.length}
            </p>
            <p className="mt-1 text-sm text-slate-200/80">
              topics fully cleared in this level
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#7dd3fc,#38bdf8)] transition-all"
                style={{ width: `${levelCompletionPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/74">
              <Flame size={14} />
              Weekly rhythm
            </div>
            {progressSummary ? (
              <>
                <p className="mt-2 text-2xl font-black tracking-tight text-white">
                  {progressSummary.weeklyStoriesFinished}/{progressSummary.weeklyGoalStories}
                </p>
                <p className="mt-1 text-sm text-slate-200/80">
                  stories finished this week
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#86efac,#4ade80)] transition-all"
                    style={{ width: `${weeklyStoryPercent}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-300/80">
                Weekly goals will show up here once progress data loads.
              </p>
            )}
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100/74">
              <Sparkles size={14} />
              Practice habit
            </div>
            {progressSummary ? (
              <>
                <p className="mt-2 text-2xl font-black tracking-tight text-white">
                  {progressSummary.weeklyPracticeSessions}/{progressSummary.weeklyGoalPracticeSessions}
                </p>
                <p className="mt-1 text-sm text-slate-200/80">
                  sessions this week · {progressSummary.storyStreakDays} day streak
                </p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#fcd34d,#f59e0b)] transition-all"
                    style={{ width: `${weeklyPracticePercent}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-300/80">
                Practice streak and weekly sessions will appear here.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,45,82,0.96),rgba(11,31,61,0.98))] px-1 py-1 shadow-[0_20px_50px_rgba(2,10,26,0.28)] sm:px-5 sm:py-4">
        <div ref={containerRef} className="relative mx-auto max-w-[26.75rem] pb-0 pt-0">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${Math.max(connectorFrame.width, 1)} ${Math.max(connectorFrame.height, 1)}`}
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="journey-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0 0 L8 4 L0 8" fill="none" stroke="rgba(163,230,53,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {connectorPaths.map((path, index) => (
              <path
                key={`connector-${index}`}
                d={path}
                fill="none"
                stroke="rgba(163,230,53,0.34)"
                strokeWidth="1"
                strokeDasharray="1.8 5.4"
                strokeLinecap="round"
                markerEnd="url(#journey-arrow)"
              />
            ))}
          </svg>
          <div className="relative flex flex-col gap-0">
            {selectedLevel.topics.map((topic, index) => {
              const visual = getTopicVisual(topic.label);
              const Icon = visual.icon;
              const unlocked = index < unlockedTopicCount;
              const hasStories = topic.storyCount > 0;
              const completed = isJourneyTopicComplete(topic, completedStoryKeySet);
              const checkpointPassed = passedCheckpointKeySet.has(
                `${selectedTrack.id}:${selectedLevel.id}:${topic.slug}`
              );
              const dueReviewCount = dueReviewCountByTopicId.get(`${selectedLevel.id}:${topic.slug}`) ?? 0;
              const coverUrl = topic.stories[0]?.coverUrl;

              return (
                <div
                  key={topic.id}
                  className="w-fit"
                  style={{ marginLeft: `${laneOffsets[index % laneOffsets.length]}%` }}
                >
                  {unlocked && hasStories ? (
                    <Link
                      href={`/journey/${selectedLevel.id}/${topic.slug}?variant=${encodeURIComponent(selectedTrack.id)}`}
                      onClick={() => {
                        void trackJourneyMetric(
                          "journey_topic_opened",
                          {
                            variantId: selectedTrack.id,
                            levelId: selectedLevel.id,
                            topicId: topic.slug,
                            topicLabel: topic.label,
                            dueReviewCount,
                            unlocked,
                          },
                          topic.slug
                        );
                      }}
                      className="group flex w-full max-w-[182px] flex-col items-center px-0.5 py-0 text-center"
                    >
                      {completed && checkpointPassed ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-emerald-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200">
                        Completed
                      </span>
                    ) : dueReviewCount > 0 ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-amber-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-amber-200">
                        {dueReviewCount} due
                      </span>
                    ) : completed ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-amber-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-amber-200">
                        Checkpoint
                      </span>
                    ) : index === 0 ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-lime-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-lime-200">
                        Start here
                      </span>
                    ) : index === unlockedTopicCount - 1 ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-sky-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-sky-200">
                        Continue
                      </span>
                    ) : null}

                      <span
                        ref={(element) => {
                          nodeRefs.current[index] = element;
                        }}
                        className={`relative flex h-[4.7rem] w-[4.7rem] items-center justify-center overflow-hidden rounded-[1.05rem] border-[3px] border-[#20395b] bg-gradient-to-b transition shadow-[0_10px_20px_rgba(59,130,246,0.16)] ${visual.node}`}
                      >
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={topic.label}
                            fill
                            sizes="76px"
                            className="object-cover"
                          />
                        ) : (
                          <Icon size={20} />
                        )}
                      </span>
                      <span className="mt-0.75 flex max-w-[5.2rem] flex-col text-[0.9rem] font-black leading-[0.96] tracking-tight text-white">
                        {renderTopicLabel(topic.label)}
                      </span>
                      <span className="mt-0.25 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-300/75">
                        {topic.storyCount} stories
                      </span>
                    </Link>
                  ) : (
                    <div className="flex w-full max-w-[182px] flex-col items-center px-0.5 py-0 text-center opacity-72">
                      <span className="mb-0.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-slate-300">
                        {!hasStories ? (
                          <>
                            <MapIcon size={12} />
                            Coming soon
                          </>
                        ) : (
                          <>
                            <Lock size={12} />
                            Locked
                          </>
                        )}
                      </span>
                      <span
                        ref={(element) => {
                          nodeRefs.current[index] = element;
                        }}
                        className="relative flex h-[4.7rem] w-[4.7rem] items-center justify-center overflow-hidden rounded-[1.05rem] border-[3px] border-[#20395b] bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]"
                      >
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={topic.label}
                            fill
                            sizes="76px"
                            className="object-cover opacity-35 grayscale"
                          />
                        ) : (
                          <Icon size={20} />
                        )}
                      </span>
                      <span className="mt-0.75 flex max-w-[5.2rem] flex-col text-[0.9rem] font-black leading-[0.96] tracking-tight text-white/85">
                        {renderTopicLabel(topic.label)}
                      </span>
                      <span className="mt-0.25 text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-300/60">
                        {!hasStories ? "No stories yet" : "Unlock later"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
