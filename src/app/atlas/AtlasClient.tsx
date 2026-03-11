"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import type { AtlasLevel } from "./atlasData";

type AtlasClientProps = {
  levels: AtlasLevel[];
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

export default function AtlasClient({ levels }: AtlasClientProps) {
  const firstUnlockedLevelId = levels[0]?.id ?? "";
  const [selectedLevelId, setSelectedLevelId] = useState(firstUnlockedLevelId);
  const selectedLevel = useMemo(
    () => levels.find((level) => level.id === selectedLevelId) ?? levels[0] ?? null,
    [levels, selectedLevelId]
  );

  if (!selectedLevel) return null;

  const unlockedTopic = selectedLevel.topics[0] ?? null;
  const laneOffsets = [0, 46, 8, 52, 14, 44];
  const nodeCenters = [14, 72, 22, 78, 28, 70];
  const verticalStep = 88;
  const pathHeight = Math.max(selectedLevel.topics.length * verticalStep - 12, 176);
  const pathD = selectedLevel.topics
    .map((_, index) => {
      const x = nodeCenters[index % nodeCenters.length];
      const y = 30 + index * verticalStep;

      if (index === 0) return `M ${x} ${y}`;

      const previousX = nodeCenters[(index - 1) % nodeCenters.length];
      const previousY = 30 + (index - 1) * verticalStep;
      const midY = previousY + verticalStep / 2;

      return `C ${previousX} ${midY - 18}, ${x} ${midY + 18}, ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-14 pt-4 sm:px-6 lg:px-8">
      <section className="rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(163,230,53,0.08),transparent_18%),linear-gradient(180deg,#0a2b56_0%,#08264d_56%,#071f43_100%)] px-4 py-2 sm:rounded-[1.75rem] sm:px-5 sm:py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-100/75">
              {selectedLevel.title} path
            </p>
            <h1 className="mt-0.5 text-[1.45rem] font-black leading-none tracking-tight text-white sm:text-[2.3rem]">
              Start {selectedLevel.title}
            </h1>
            <p className="mt-1 text-sm text-slate-300/82">
              Begin with {unlockedTopic?.label ?? "the first topic"}. More topics unlock as you go.
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Map size={18} className="text-lime-100/80" />
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          {levels.map((level) => {
            const active = level.id === selectedLevelId;
            const unlocked = level.id === firstUnlockedLevelId;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => {
                  if (!unlocked) return;
                  setSelectedLevelId(level.id);
                }}
                aria-disabled={!unlocked}
                className={`rounded-full border px-4 py-2 text-sm font-black uppercase tracking-[0.14em] transition ${
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
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,45,82,0.96),rgba(11,31,61,0.98))] px-2.5 py-3 shadow-[0_20px_50px_rgba(2,10,26,0.28)] sm:px-5 sm:py-4">
        <div className="relative mx-auto max-w-[24rem] pb-1 pt-0" style={{ minHeight: `${pathHeight}px` }}>
          <svg
            aria-hidden="true"
            viewBox={`0 0 100 ${pathHeight}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d={pathD}
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={pathD}
              fill="none"
              stroke="rgba(163,230,53,0.30)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <div className="relative flex flex-col gap-3.5">
            {selectedLevel.topics.map((topic, index) => {
              const visual = getTopicVisual(topic.label);
              const Icon = visual.icon;
              const unlocked = index === 0;
              const coverUrl = topic.stories[0]?.coverUrl;

              return (
                <div
                  key={topic.id}
                  className="w-full"
                  style={{ marginLeft: `${laneOffsets[index % laneOffsets.length]}%` }}
                >
                  {unlocked ? (
                    <Link
                      href={`/atlas/${selectedLevel.id}/${topic.slug}`}
                      className="group flex w-full max-w-[210px] flex-col items-center text-center"
                    >
                      {index === 0 ? (
                      <span className="mb-1 inline-flex rounded-full border border-lime-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-lime-200">
                        Start here
                      </span>
                    ) : null}

                      <span
                        className={`relative flex h-[4.15rem] w-[4.15rem] items-center justify-center overflow-hidden rounded-[1rem] border-[3px] border-[#20395b] bg-gradient-to-b transition shadow-[0_10px_20px_rgba(59,130,246,0.16)] ${visual.node}`}
                      >
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={topic.label}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        ) : (
                          <Icon size={24} />
                        )}
                      </span>
                      <span className="mt-1.5 text-[0.92rem] font-black leading-tight tracking-tight text-white">{topic.label}</span>
                      <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300/75">
                        {topic.storyCount} stories
                      </span>
                    </Link>
                  ) : (
                    <div className="flex w-full max-w-[210px] flex-col items-center text-center opacity-72">
                      <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                        <Lock size={12} />
                        Locked
                      </span>
                      <span className="relative flex h-[4.15rem] w-[4.15rem] items-center justify-center overflow-hidden rounded-[1rem] border-[3px] border-[#20395b] bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]">
                        {coverUrl ? (
                          <Image
                            src={coverUrl}
                            alt={topic.label}
                            fill
                            sizes="72px"
                            className="object-cover opacity-35 grayscale"
                          />
                        ) : (
                          <Icon size={24} />
                        )}
                      </span>
                      <span className="mt-1.5 text-[0.92rem] font-black leading-tight tracking-tight text-white/85">{topic.label}</span>
                      <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300/60">
                        Unlock later
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
