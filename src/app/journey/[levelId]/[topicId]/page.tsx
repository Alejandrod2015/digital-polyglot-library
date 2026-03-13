import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronLeft, Lock, Map, Sparkles, Star } from "lucide-react";
import {
  buildJourneyLevels,
  getJourneyTopicCheckpointKey,
  getUnlockedStoryCount,
  isJourneyStoryComplete,
  isJourneyTopicComplete,
} from "../../journeyData";
import { formatVariantLabel, normalizeVariant } from "@/lib/languageVariant";
import { getCompletedJourneyStoryKeys, getPassedJourneyCheckpointKeys } from "@/lib/journeyProgress";

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

  const laneOffsets = [0, 46, 8, 52, 14, 44];
  const nodeCenters = [14, 72, 22, 78, 28, 70];
  const totalNodes = topic.stories.length + 1;
  const verticalStep = 86;
  const journeyHeight = Math.max(totalNodes * verticalStep - 10, 184);
  const returnTo = activeVariant
    ? `/journey/${level.id}/${topic.slug}?variant=${encodeURIComponent(activeVariant)}`
    : `/journey/${level.id}/${topic.slug}`;
  const returnLabel = topic.label;
  const journeyD = Array.from({ length: totalNodes }, (_, index) => {
    const x = nodeCenters[index % nodeCenters.length];
    const y = 28 + index * verticalStep;

    if (index === 0) return `M ${x} ${y}`;

    const previousX = nodeCenters[(index - 1) % nodeCenters.length];
    const previousY = 28 + (index - 1) * verticalStep;
    const midY = previousY + verticalStep / 2;

    return `C ${previousX} ${midY - 18}, ${x} ${midY + 18}, ${x} ${y}`;
  }).join(" ");

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

        <div className="relative mx-auto max-w-[24rem] pb-1.5 pt-0" style={{ minHeight: `${journeyHeight}px` }}>
          <svg
            aria-hidden="true"
            viewBox={`0 0 100 ${journeyHeight}`}
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d={journeyD}
              fill="none"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d={journeyD}
              fill="none"
              stroke="rgba(96, 165, 250, 0.34)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>

          <div className="relative flex flex-col gap-3.5">
            {topic.stories.map((story, index) => {
              const isUnlocked = index < unlockedStoryCount;
              const isCompleted = isJourneyStoryComplete(story, completedStoryKeys);
              const storyHref = `${story.href}?returnTo=${encodeURIComponent(returnTo)}&returnLabel=${encodeURIComponent(returnLabel)}`;

              return (
                <div key={story.id} className="w-full" style={{ marginLeft: `${laneOffsets[index % laneOffsets.length]}%` }}>
                  {isUnlocked ? (
                    <Link
                      href={storyHref}
                      className="group flex max-w-[210px] flex-col items-center text-center"
                    >
                      {isCompleted ? (
                        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                          Completed
                        </span>
                      ) : index === 0 ? (
                        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-lime-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-lime-200">
                          <Star size={12} />
                          Start
                        </span>
                      ) : index === unlockedStoryCount - 1 ? (
                        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-sky-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-200">
                          Continue
                        </span>
                      ) : null}

                      <span className="relative flex h-[3.85rem] w-[3.85rem] items-center justify-center overflow-hidden rounded-[0.95rem] border-[3px] border-[#20395b] bg-[linear-gradient(180deg,#75d9ff_0%,#4f8df7_100%)] text-slate-950 shadow-[0_8px_18px_rgba(59,130,246,0.18)] transition duration-200 group-hover:scale-[1.04]">
                        {story.coverUrl ? (
                          <Image
                            src={story.coverUrl}
                            alt={story.title}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        ) : (
                          <Map size={24} />
                        )}
                      </span>

                      <span className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200/75">
                        Story {index + 1}
                      </span>
                      <h3 className="mt-1 text-[0.92rem] font-black leading-tight tracking-tight text-white">
                        {story.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-[10px] uppercase tracking-[0.14em] text-slate-300/65">
                        {story.region ?? story.language ?? "Global"}
                      </p>
                    </Link>
                  ) : (
                    <div className="flex max-w-[210px] flex-col items-center text-center opacity-72">
                      <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                        <Lock size={12} />
                        Locked
                      </span>

                      <span className="relative flex h-[3.85rem] w-[3.85rem] items-center justify-center overflow-hidden rounded-[0.95rem] border-[3px] border-[#20395b] bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]">
                        {story.coverUrl ? (
                          <Image
                            src={story.coverUrl}
                            alt={story.title}
                            fill
                            sizes="72px"
                            className="object-cover grayscale opacity-55"
                          />
                        ) : (
                          <Map size={24} />
                        )}
                      </span>

                      <span className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200/75">
                        Story {index + 1}
                      </span>
                      <h3 className="mt-1 text-[0.92rem] font-black leading-tight tracking-tight text-white/80">
                        {story.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-[10px] uppercase tracking-[0.14em] text-slate-300/55">
                        Unlock later
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {topicCompleted && !checkpointPassed ? (
              <div className="w-full" style={{ marginLeft: `${laneOffsets[topic.stories.length % laneOffsets.length]}%` }}>
                <Link
                  href={`/journey/${level.id}/${topic.slug}/checkpoint${activeVariant ? `?variant=${encodeURIComponent(activeVariant)}` : ""}`}
                  className="group flex max-w-[210px] flex-col items-center text-center"
                >
                  <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">
                    <Star size={12} />
                    Checkpoint
                  </span>
                  <span className="flex h-[3.85rem] w-[3.85rem] items-center justify-center rounded-[0.95rem] border-[3px] border-[#20395b] bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_100%)] text-slate-950 shadow-[0_8px_18px_rgba(245,158,11,0.18)] transition duration-200 group-hover:scale-[1.04]">
                    <Sparkles size={20} />
                  </span>
                </Link>
              </div>
            ) : !topicCompleted ? (
              <div className="w-full" style={{ marginLeft: `${laneOffsets[topic.stories.length % laneOffsets.length]}%` }}>
                <div className="flex max-w-[210px] flex-col items-center text-center opacity-72">
                  <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                    <Lock size={12} />
                    Finish this journey
                  </span>
                  <span className="flex h-[3.85rem] w-[3.85rem] items-center justify-center rounded-[0.95rem] border-[3px] border-[#20395b] bg-[#314861] text-white/45 shadow-[inset_0_-10px_0_rgba(0,0,0,0.16)]">
                    <Sparkles size={20} />
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full" style={{ marginLeft: `${laneOffsets[topic.stories.length % laneOffsets.length]}%` }}>
                <div className="flex max-w-[210px] flex-col items-center text-center opacity-90">
                  <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/20 bg-[#13284a] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
                    Journey cleared
                  </span>
                  <span className="flex h-[3.85rem] w-[3.85rem] items-center justify-center rounded-[0.95rem] border-[3px] border-[#20395b] bg-[linear-gradient(180deg,#6ee7b7_0%,#10b981_100%)] text-slate-950 shadow-[0_8px_18px_rgba(16,185,129,0.18)]">
                    <Sparkles size={20} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
