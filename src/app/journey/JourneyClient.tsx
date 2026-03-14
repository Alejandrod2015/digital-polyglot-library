"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  BusFront,
  ChefHat,
  FerrisWheel,
  HeartHandshake,
  Leaf,
  Lightbulb,
  Lock,
  Map,
  type LucideIcon,
  Store,
} from "lucide-react";
import { getUnlockedLevelCount, getUnlockedTopicCount, isJourneyTopicComplete, type JourneyVariantTrack } from "./journeyData";

type JourneyClientProps = {
  tracks: JourneyVariantTrack[];
  initialVariantId: string;
  completedStoryKeys: string[];
  passedCheckpointKeys: string[];
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
}: JourneyClientProps) {
  const searchParams = useSearchParams();
  const firstTrackId = tracks[0]?.id ?? "";
  const [selectedVariantId] = useState(
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
  const selectedLevel = useMemo(() => {
    const unlockedIds = new Set(levels.slice(0, unlockedLevelCount).map((level) => level.id));
    if (unlockedIds.has(selectedLevelId)) {
      return levels.find((level) => level.id === selectedLevelId) ?? levels[0] ?? null;
    }
    return levels.find((level) => level.id === firstUnlockedLevelId) ?? levels[0] ?? null;
  }, [firstUnlockedLevelId, levels, selectedLevelId, unlockedLevelCount]);

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

  if (!selectedLevel || !selectedTrack) return null;

  const unlockedTopicCount = getUnlockedTopicCount(
    selectedLevel,
    completedStoryKeySet,
    passedCheckpointKeySet,
    selectedTrack.id,
    selectedLevel.id
  );
  const laneOffsets = [8, 60, 12, 64, 16, 60];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-14 pt-4 sm:gap-4 sm:px-6 lg:px-8">
      <section className="rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.08),transparent_18%),linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] px-4 py-2 sm:rounded-[1.75rem] sm:px-5 sm:py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="h-[11px]" />
          <div className="hidden items-center gap-2 sm:flex">
            <Map size={18} className="text-lime-100/80" />
          </div>
        </div>

        <div className="mt-0.5">
          <span className="inline-flex rounded-full border border-lime-200/18 bg-white/[0.04] px-2.5 py-0.5 text-[0.72rem] font-black uppercase tracking-[0.15em] text-lime-100/88 sm:px-3 sm:py-1 sm:text-[0.8rem]">
            {selectedTrack.label}
          </span>
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
                      className="group flex w-full max-w-[182px] flex-col items-center px-0.5 py-0 text-center"
                    >
                      {completed && checkpointPassed ? (
                      <span className="mb-0.5 inline-flex rounded-full border border-emerald-200/20 bg-[#13284a] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200">
                        Completed
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
                            <Map size={12} />
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
