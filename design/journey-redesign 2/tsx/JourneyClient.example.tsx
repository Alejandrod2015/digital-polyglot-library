// ============================================================
// JourneyClient.example.tsx
// NOT a drop-in file. Shows the EXACT wiring of the 3 new
// components inside src/app/journey/JourneyClient.tsx.
// ============================================================

"use client";

import JourneyTopBar       from "@/components/JourneyTopBar";
import JourneyTopicBanner  from "@/components/JourneyTopicBanner";
import JourneyStoryCard, { type StoryNodeState } from "@/components/JourneyStoryCard";

// ─── Topic palette (matches iPhone TOPIC_PANEL_PALETTE exactly) ───
// Cycle through these in order for each topic across the whole journey.
export const TOPIC_PALETTE = [
  "#1f7ee0", // blue
  "#58a700", // green
  "#a560e8", // purple
  "#ff9600", // orange
  "#ff4b4b", // red
  "#00b894", // teal
  "#e17055", // terracotta
  "#5dd9e8", // cyan
  "#f5b942", // amber
  "#ff8aa8", // pink
] as const;

// ─── Wave (zigzag) offsets ────────────────────────────────────────
// Cycles through these left-paddings as you go down the list of
// stories within a topic. Subtle but readable. Matches iPhone's
// `journeyPathNodeRow` per-story marginLeft computation.
const WAVE_PATTERN = [0, 90, 35, 120, 60, 100, 25, 80, 45];

export default function JourneyClient(props: any /* keep existing props */) {
  // Shape coming from the server (props.activeJourneyTrack):
  //
  //   {
  //     levels: [
  //       {
  //         id: "A1",
  //         unlocked: true,
  //         topics: [
  //           {
  //             slug: "food-and-drink",
  //             label: "Food & Drink",
  //             stories: [
  //               { slug, title, coverUrl, state: "done" | "next" | "available" | "locked" },
  //               ...
  //             ],
  //           },
  //         ],
  //       },
  //       { id: "A2", unlocked: false, topics: [...] },
  //     ],
  //   }
  //
  // The mock below shows the structure. Replace with the real `track`.
  const track = props.activeJourneyTrack;

  // Flatten levels → topics so we can colour them by their absolute
  // index across the journey (same as the iPhone topicColorByKey loop).
  type FlatTopic = {
    slug: string;
    title: string;
    levelId: string;
    locked: boolean;
    stories: Array<{
      slug: string;
      title: string;
      coverUrl?: string;
      state: StoryNodeState;
    }>;
  };
  const flatTopics: FlatTopic[] = [];
  for (const level of track.levels) {
    for (const topic of level.topics) {
      flatTopics.push({
        slug: topic.slug,
        title: topic.label,
        levelId: level.id,
        locked: !level.unlocked,
        stories: topic.stories.map((s: any): { slug: string; title: string; coverUrl?: string; state: StoryNodeState } => ({
          slug: s.slug,
          title: s.title,
          coverUrl: s.coverUrl,
          state: !level.unlocked ? "locked" : (s.state ?? "available"),
        })),
      });
    }
  }

  return (
    <div className="px-10 py-7 pb-20 max-w-[1480px]">
      <JourneyTopBar
        language={{ code: "ES", flag: "🇪🇸" }}
        stats={{ energy: 8, level: 7, xp: 1400 }}
        onTapLanguage={() => { /* open LanguageSwitcher */ }}
      />

      {flatTopics.map((topic, topicIndex) => {
        const color = TOPIC_PALETTE[topicIndex % TOPIC_PALETTE.length];
        return (
          <section key={topic.slug} className="mb-7">
            <JourneyTopicBanner
              levelId={topic.levelId}
              title={topic.title}
              color={color}
              locked={topic.locked}
              onTap={() => { /* open topic detail */ }}
            />

            {topic.stories.map((story, i) => (
              <JourneyStoryCard
                key={story.slug}
                story={{
                  href: `/stories/${story.slug}?from=journey`,
                  title: story.title,
                  coverUrl: story.coverUrl,
                  state: story.state,
                }}
                color={color}
                waveOffset={WAVE_PATTERN[i % WAVE_PATTERN.length]}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

// ============================================================
// Helper: determine each story's state from progress data.
// Drop into a shared util — `src/lib/journeyState.ts`.
// ============================================================

export function deriveStoryState(opts: {
  isLevelUnlocked: boolean;
  isStoryComplete: boolean;
  isNextRecommended: boolean;
  isUnlocked: boolean;
}): StoryNodeState {
  if (!opts.isLevelUnlocked || !opts.isUnlocked) return "locked";
  if (opts.isStoryComplete) return "done";
  if (opts.isNextRecommended) return "next";
  return "available";
}
