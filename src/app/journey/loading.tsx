// Loading skeleton for the Journey page. Mirrors the real layout
// (JourneyClient): a top bar, then a vertical flow of chunky topic
// banners each followed by a zigzag of story-node cards. Dimensions and
// the wave offsets are copied from JourneyTopicBanner / JourneyStoryCard /
// WAVE_PATTERN so the placeholder reads like the real path, not a generic
// dashboard.
const WAVE = [0, 40, 80, 110];

function StoryRow({ offset, active }: { offset: number; active?: boolean }) {
  return (
    <div className="mb-[18px] flex items-center" style={{ paddingLeft: `${offset}px` }}>
      <div
        className={[
          "flex w-full max-w-[440px] items-center gap-4 rounded-[22px] p-3 pr-[18px]",
          active
            ? "bg-white/[0.12] shadow-[0_0_28px_-4px_rgba(96,165,250,0.55),0_4px_0_rgba(0,0,0,0.35)]"
            : "bg-white/[0.06] shadow-[0_4px_0_rgba(0,0,0,0.30)]",
        ].join(" ")}
      >
        <div className="h-16 w-16 shrink-0 rounded-[16px] bg-white/12" />
        <div className="min-w-0 flex-1">
          <div className="h-4 w-3/5 rounded bg-white/15" />
        </div>
        <div className="h-7 w-7 shrink-0 rounded-full bg-white/12" />
      </div>
    </div>
  );
}

function TopicSection({ storyCount, activeIndex }: { storyCount: number; activeIndex?: number }) {
  return (
    <section className="mb-2">
      {/* Topic banner — chunky full-width card: eyebrow + big title + icon */}
      <div className="mb-8 flex w-full items-center gap-[14px] rounded-[22px] bg-white/[0.08] p-[22px] shadow-[inset_0_2px_0_rgba(255,255,255,0.10),0_5px_0_rgba(0,0,0,0.35)]">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="h-3 w-36 rounded bg-white/15" />
          <div className="h-7 w-1/2 rounded-md bg-white/20" />
        </div>
        <div className="h-11 w-11 shrink-0 rounded-[14px] bg-white/12" />
      </div>
      {/* Story node path — zigzag via wave offsets */}
      <div className="mb-6 flex flex-col">
        {Array.from({ length: storyCount }).map((_, i) => (
          <StoryRow key={i} offset={WAVE[i % WAVE.length]} active={i === activeIndex} />
        ))}
      </div>
    </section>
  );
}

export default function LoadingJourneyPage() {
  return (
    <div className="dp-journey-page flex w-full animate-pulse flex-col gap-6 px-6 pb-20 pt-7 sm:px-10">
      {/* Top bar: language pill (left) + stats (right) */}
      <div className="flex items-center justify-between">
        <div className="h-11 w-28 rounded-full bg-white/10" />
        <div className="flex items-center gap-4">
          <div className="h-5 w-12 rounded-full bg-white/[0.08]" />
          <div className="h-5 w-14 rounded-full bg-white/[0.08]" />
          <div className="h-5 w-14 rounded-full bg-white/[0.08]" />
        </div>
      </div>

      {/* Vertical journey flow: topic banner → zigzag story cards */}
      <div className="flex flex-col">
        <TopicSection storyCount={4} activeIndex={0} />
        <TopicSection storyCount={3} />
      </div>
    </div>
  );
}
