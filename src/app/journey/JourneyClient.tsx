"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  BusFront,
  ChefHat,
  FerrisWheel,
  HeartHandshake,
  Leaf,
  Lightbulb,
  Lock,
  Map as MapIcon,
  Sparkles,
  type LucideIcon,
  Store,
} from "lucide-react";
import {
  buildJourneyTrackInsights,
  getJourneyPlacementLevelIndex,
  getJourneyTopicCheckpointKey,
  getJourneyTopicCompletedStoryCount,
  getJourneyTopicPracticeKey,
  getJourneyTopicRequiredStoryCount,
  getUnlockedLevelCount,
  getUnlockedTopicCount,
  isJourneyTopicComplete,
  type JourneyTrackInsights,
  type JourneyVariantTrack,
} from "./journeyData";
import type { JourneyDueReviewItem } from "@/lib/journeyProgress";

type JourneyClientProps = {
  tracks: JourneyVariantTrack[];
  initialVariantId: string;
  preferredLevel: string | null;
  learningGoal: string | null;
  journeyFocus: string | null;
  dailyMinutes: number | null;
  journeyPlacementLevel: string | null;
  initialInsights: JourneyTrackInsights | null;
  completedStoryKeys: string[];
  passedCheckpointKeys: string[];
  practicedTopicKeys: string[];
  dueReviewItems: JourneyDueReviewItem[];
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
  preferredLevel,
  learningGoal,
  journeyFocus,
  dailyMinutes,
  journeyPlacementLevel: initialJourneyPlacementLevel,
  initialInsights,
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
  const [journeyPlacementLevel, setJourneyPlacementLevel] = useState<string | null>(initialJourneyPlacementLevel);
  const [placementSaving, setPlacementSaving] = useState(false);
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
  const placementLevelIndex = useMemo(
    () => getJourneyPlacementLevelIndex(levels, journeyPlacementLevel),
    [journeyPlacementLevel, levels]
  );
  const unlockedLevelCount = useMemo(
    () => {
      const baseUnlocked = getUnlockedLevelCount(
        levels,
        completedStoryKeySet,
        passedCheckpointKeySet,
        selectedTrack?.id
      );
      return placementLevelIndex >= 0
        ? Math.max(baseUnlocked, Math.min(levels.length, placementLevelIndex + 1))
        : baseUnlocked;
    },
    [completedStoryKeySet, levels, passedCheckpointKeySet, placementLevelIndex, selectedTrack]
  );
  const firstUnlockedLevelId = levels[Math.max(0, unlockedLevelCount - 1)]?.id ?? levels[0]?.id ?? "";
  const [selectedLevelId, setSelectedLevelId] = useState(firstUnlockedLevelId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [connectorFrame, setConnectorFrame] = useState({ width: 0, height: 0 });
  const [connectorPaths, setConnectorPaths] = useState<string[]>([]);
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

  const selectedLevelIndex = levels.findIndex((level) => level.id === selectedLevel?.id);
  const unlockedTopicCount = selectedLevelIndex >= 0 && placementLevelIndex >= 0 && selectedLevelIndex < placementLevelIndex
    ? selectedLevel?.topics.length ?? 0
    : getUnlockedTopicCount(
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
  const personalizedJourneyMessage = useMemo(() => {
    const parts: string[] = [];
    if (typeof journeyFocus === "string" && journeyFocus.trim() && journeyFocus.trim() !== "General") {
      parts.push(journeyFocus.trim());
    } else if (typeof learningGoal === "string" && learningGoal.trim()) {
      parts.push(`${learningGoal.trim()} focus`);
    }
    if (typeof preferredLevel === "string" && preferredLevel.trim()) {
      parts.push(`${preferredLevel.trim()} track`);
    }
    if (typeof dailyMinutes === "number" && Number.isFinite(dailyMinutes)) {
      parts.push(`${dailyMinutes} min a day`);
    }
    return parts.join(" · ");
  }, [dailyMinutes, journeyFocus, learningGoal, preferredLevel]);
  const suggestedPlacementLevel = useMemo(() => {
    const candidateOrder =
      preferredLevel === "Advanced"
        ? ["b2", "b1", "a2"]
        : preferredLevel === "Intermediate"
          ? ["b1", "a2", "a1"]
          : ["a1"];
    return candidateOrder.find((candidate) => levels.some((level) => level.id === candidate)) ?? levels[0]?.id ?? null;
  }, [levels, preferredLevel]);
  const saveJourneyPlacementLevel = async (levelId: string | null) => {
    setPlacementSaving(true);
    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyPlacementLevel: levelId }),
      });
      if (!response.ok) {
        throw new Error("Could not save placement.");
      }
      setJourneyPlacementLevel(levelId);
    } catch {
      // Best-effort UI update only.
    } finally {
      setPlacementSaving(false);
    }
  };
  const selectedTrackInsights = useMemo(() => {
    if (!selectedTrack) return initialInsights;
    return buildJourneyTrackInsights(
      selectedTrack,
      completedStoryKeySet,
      practicedTopicKeySet,
      passedCheckpointKeySet,
      dueReviewItems
    );
  }, [
    completedStoryKeySet,
    dueReviewItems,
    initialInsights,
    passedCheckpointKeySet,
    practicedTopicKeySet,
    selectedTrack,
  ]);
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

        <div className="-mx-1 mt-0.5 overflow-x-auto px-1 sm:mx-0 sm:overflow-visible sm:px-0">
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

      </section>

      {personalizedJourneyMessage ? (
        <section className="rounded-[1.35rem] border border-lime-200/10 bg-[linear-gradient(180deg,rgba(19,50,83,0.84),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-lime-200/72">Your plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white/86">
              <Sparkles size={14} className="text-lime-200" />
              {personalizedJourneyMessage}
            </span>
            <span className="text-sm text-white/60">
              Journey will keep pushing the next best step for this setup.
            </span>
          </div>
        </section>
      ) : null}

      {selectedTrackInsights ? (
        <section className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,50,83,0.84),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-100/72">Journey score</p>
            <div className="mt-1 flex items-end gap-3">
              <p className="text-4xl font-black leading-none tracking-tight text-white">{selectedTrackInsights.score}</p>
              <div className="pb-1 text-sm text-slate-300/82">
                <p>{selectedTrackInsights.completedSteps}/{selectedTrackInsights.totalSteps} steps cleared</p>
                <p>{selectedTrackInsights.currentLevelTitle ?? "Track"} active</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#bef264,#38bdf8)]"
                style={{ width: `${Math.max(6, selectedTrackInsights.score)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-200/82">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Stories {selectedTrackInsights.completedRequiredStories}/{selectedTrackInsights.totalRequiredStories}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Practice {selectedTrackInsights.practicedTopicCount}/{selectedTrackInsights.totalTopicCount}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Checkpoints {selectedTrackInsights.passedCheckpointCount}/{selectedTrackInsights.totalCheckpointCount}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300/80">Next milestone: {selectedTrackInsights.nextMilestone}</p>
          </div>

          <div className="rounded-[1.35rem] border border-amber-200/10 bg-[linear-gradient(180deg,rgba(48,37,18,0.42),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-amber-100/78">Review lane</p>
                <p className="mt-1 text-lg font-black tracking-tight text-white">
                  {selectedTrackInsights.dueReviewCount > 0
                    ? `${selectedTrackInsights.dueReviewCount} due across ${selectedTrackInsights.dueTopicCount} ${selectedTrackInsights.dueTopicCount === 1 ? "topic" : "topics"}`
                    : "No due review right now"}
                </p>
              </div>
              {selectedTrackInsights.dueReviewCount > 0 ? (
                <span className="rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100">
                  Keep the path warm
                </span>
              ) : null}
            </div>
            {selectedTrackInsights.reviewTopics.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTrackInsights.reviewTopics.slice(0, 3).map((topic) => (
                  <Link
                    key={`${topic.levelId}:${topic.topicSlug}`}
                    href={`/journey/${topic.levelId}/${topic.topicSlug}?variant=${encodeURIComponent(selectedTrack.id)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/84 hover:bg-white/10"
                  >
                    <span>{topic.topicLabel}</span>
                    <span className="text-amber-100">{topic.dueCount} due</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-300/78">
                Your review queue is clear. Keep pushing new topics and the lane will stay clean.
              </p>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,50,83,0.84),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-violet-100/72">Placement</p>
            <p className="mt-1 text-lg font-black tracking-tight text-white">
              {journeyPlacementLevel
                ? `Starting from ${(levels.find((level) => level.id === journeyPlacementLevel)?.title ?? journeyPlacementLevel).toUpperCase()}`
                : "Calibrate where this path should begin"}
            </p>
            <p className="mt-1 text-sm text-slate-300/80">
              {journeyPlacementLevel
                ? "You can still go back and read earlier levels, but the path won't force them first."
                : "Skip to the right level now and avoid grinding through topics you already know."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <button
                key={`placement-${level.id}`}
                type="button"
                disabled={placementSaving}
                onClick={() => void saveJourneyPlacementLevel(level.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${
                  journeyPlacementLevel === level.id
                    ? "border-violet-200/30 bg-violet-300/16 text-violet-50"
                    : suggestedPlacementLevel === level.id && !journeyPlacementLevel
                      ? "border-lime-200/25 bg-lime-300/10 text-lime-100"
                      : "border-white/10 bg-white/5 text-slate-200/82"
                }`}
              >
                {level.title}
              </button>
            ))}
            {journeyPlacementLevel ? (
              <button
                type="button"
                disabled={placementSaving}
                onClick={() => void saveJourneyPlacementLevel(null)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200/82"
              >
                Reset
              </button>
            ) : null}
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
              const unlocked = placementLevelIndex >= 0 && selectedLevelIndex >= 0 && selectedLevelIndex < placementLevelIndex
                ? true
                : index < unlockedTopicCount;
              const hasStories = topic.storyCount > 0;
              const completed = isJourneyTopicComplete(topic, completedStoryKeySet);
              const previousTopic = index > 0 ? selectedLevel.topics[index - 1] : null;
              const previousTopicCompleted = previousTopic
                ? isJourneyTopicComplete(previousTopic, completedStoryKeySet)
                : true;
              const previousTopicCheckpointPassed = previousTopic
                ? passedCheckpointKeySet.has(
                    getJourneyTopicCheckpointKey(selectedTrack.id, selectedLevel.id, previousTopic.slug)
                  )
                : true;
              const previousTopicRemaining = previousTopic
                ? Math.max(
                    getJourneyTopicRequiredStoryCount(previousTopic) -
                      getJourneyTopicCompletedStoryCount(previousTopic, completedStoryKeySet),
                    0
                  )
                : 0;
              const checkpointPassed = passedCheckpointKeySet.has(
                `${selectedTrack.id}:${selectedLevel.id}:${topic.slug}`
              );
              const dueReviewCount = dueReviewCountByTopicId.get(`${selectedLevel.id}:${topic.slug}`) ?? 0;
              const coverUrl = topic.stories[0]?.coverUrl;
              const lockedBadge = !hasStories
                ? "Coming soon"
                : !previousTopicCompleted
                  ? "Finish previous"
                  : !previousTopicCheckpointPassed
                    ? "Checkpoint first"
                    : "Locked";
              const lockedMeta = !hasStories
                ? "No stories yet"
                : !previousTopicCompleted && previousTopic
                  ? `Finish ${previousTopicRemaining} more ${previousTopicRemaining === 1 ? "story" : "stories"} in ${previousTopic.label}`
                  : !previousTopicCheckpointPassed && previousTopic
                    ? `Pass the ${previousTopic.label} checkpoint`
                    : "Unlock later";

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
                            {lockedBadge}
                          </>
                        ) : (
                          <>
                            <Lock size={12} />
                            {lockedBadge}
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
                        {lockedMeta}
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
