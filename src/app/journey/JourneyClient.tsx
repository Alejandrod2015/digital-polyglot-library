"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildJourneyTrackInsights,
  getJourneyPlacementLevelIndex,
  getUnlockedLevelCount,
  type JourneyTrackInsights,
  type JourneyVariantTrack,
} from "./journeyData";
import { isJourneyStoryComplete } from "@/lib/journeyUnlock";
import type { JourneyDueReviewItem } from "@/lib/journeyProgress";
import { JourneyLanguageHub } from "@/components/JourneyLanguageHub";
import { TopicPreviewSheet } from "@/components/TopicPreviewSheet";
import JourneyTopBar from "@/components/JourneyTopBar";
import BottomSheet from "@/components/ui/BottomSheet";
import JourneyTopicBanner from "@/components/JourneyTopicBanner";
import JourneyStoryCard, { type StoryNodeState } from "@/components/JourneyStoryCard";

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

// Same order as the iPhone TOPIC_PANEL_PALETTE — cycle across the whole
// flat list of topics (NOT per level) so colours don't reset at A2.
const TOPIC_PALETTE = [
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

// Subtle zigzag offsets (left padding) per story row inside a topic.
// Smoother SINE-style wave: small jumps between adjacent rows so the
// path reads as a continuous line rather than a jumpy scatter.
const WAVE_PATTERN = [0, 40, 80, 110, 90, 60, 30, 60, 90];

// Topic-label → emoji map. Used as the thumbnail fallback when a story
// has no cover so the placeholder doesn't render an empty box or the
// pure-fallback "📖" book icon for every missing cover.
const TOPIC_EMOJI: Array<{ match: RegExp; emoji: string }> = [
  { match: /food|drink|cook|cafe|restaurant|market/i, emoji: "🍞" },
  { match: /home|family|love|relationship/i, emoji: "👵" },
  { match: /meet|people|friend/i, emoji: "👋" },
  { match: /airport|transit|travel|transport|station|city|place/i, emoji: "✈️" },
  { match: /shop|money|finance/i, emoji: "💸" },
  { match: /health|wellbeing|body/i, emoji: "🌿" },
  { match: /around|navigate|direction/i, emoji: "🗺️" },
  { match: /accommodation|stay|hotel|house/i, emoji: "🏠" },
  { match: /work|career|office|job/i, emoji: "💼" },
  { match: /nature|environment/i, emoji: "🌳" },
  { match: /history|culture|tradition/i, emoji: "🏛️" },
];

function topicEmoji(label: string): string {
  const found = TOPIC_EMOJI.find((entry) => entry.match.test(label));
  return found?.emoji ?? "📖";
}

// Map the journey track id to the language pill code + flag shown in
// the top bar. Falls back to a globe emoji for unmapped variants.
const LANGUAGE_PILL_BY_VARIANT: Record<string, { code: string; flag: string }> = {
  latam: { code: "ES", flag: "🇲🇽" },
  spain: { code: "ES", flag: "🇪🇸" },
  br: { code: "PT", flag: "🇧🇷" },
  pt: { code: "PT", flag: "🇵🇹" },
  fr: { code: "FR", flag: "🇫🇷" },
  it: { code: "IT", flag: "🇮🇹" },
  de: { code: "DE", flag: "🇩🇪" },
  jp: { code: "JA", flag: "🇯🇵" },
  ko: { code: "KO", flag: "🇰🇷" },
  en: { code: "EN", flag: "🇬🇧" },
};

function pillForTrack(track: JourneyVariantTrack | null): { code: string; flag: string } {
  if (!track) return { code: "??", flag: "🌐" };
  const variantKey = (track.variant ?? track.id ?? "").toLowerCase();
  return LANGUAGE_PILL_BY_VARIANT[variantKey] ?? { code: variantKey.toUpperCase().slice(0, 2) || "??", flag: "🌐" };
}

export default function JourneyClient({
  tracks,
  initialVariantId,
  journeyPlacementLevel: initialJourneyPlacementLevel,
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
  const [journeyPlacementLevel] = useState<string | null>(initialJourneyPlacementLevel);
  const [stats, setStats] = useState<{ energy: number; level: number; xp: number }>({
    energy: 0,
    level: 1,
    xp: 0,
  });

  type PreviewState = {
    label: string;
    eyebrow: string;
    description: string;
    coverUrl?: string | null;
    storyCount: number;
    stories: Array<{ slug: string; title: string }>;
    ctaHref: string | null;
    ctaDisabledLabel?: string;
  } | null;
  const [previewTopic, setPreviewTopic] = useState<PreviewState>(null);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);

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
  const practicedTopicKeySet = useMemo(() => new Set(practicedTopicKeys), [practicedTopicKeys]);

  const placementLevelIndex = useMemo(
    () => getJourneyPlacementLevelIndex(levels, journeyPlacementLevel),
    [journeyPlacementLevel, levels]
  );
  const unlockedLevelCount = useMemo(() => {
    const baseUnlocked = getUnlockedLevelCount(
      levels,
      completedStoryKeySet,
      passedCheckpointKeySet,
      selectedTrack?.id
    );
    return placementLevelIndex >= 0
      ? Math.max(baseUnlocked, Math.min(levels.length, placementLevelIndex + 1))
      : baseUnlocked;
  }, [completedStoryKeySet, levels, passedCheckpointKeySet, placementLevelIndex, selectedTrack]);

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

  // Keep ?variant=… in the URL in sync with the selected track.
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

  // Pull live progress stats for the top bar (energy / level / xp).
  // Falls back silently to zeroes if the call fails.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/progress");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const g = data?.gamification ?? {};
        setStats({
          energy:
            typeof g.todayXp === "number"
              ? g.todayXp
              : typeof data?.practiceStreakDays === "number"
                ? data.practiceStreakDays
                : 0,
          level: typeof g.currentLevel === "number" ? g.currentLevel : 1,
          xp: typeof g.totalXp === "number" ? g.totalXp : 0,
        });
      } catch {
        // non-blocking
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-topic "next" recommendation: the first not-yet-complete story
  // inside each unlocked topic. Each active topic gets exactly one
  // pulsing-halo card; locked levels get none.
  const nextStoryKeyByTopic = useMemo(() => {
    const map = new Map<string, string>();
    levels.forEach((level, levelIndex) => {
      if (levelIndex >= unlockedLevelCount) return;
      for (const topic of level.topics) {
        const firstIncomplete = topic.stories.find(
          (s) => !isJourneyStoryComplete(s, completedStoryKeySet)
        );
        if (firstIncomplete) {
          map.set(`${level.id}:${topic.slug}`, firstIncomplete.progressKey);
        }
      }
    });
    return map;
  }, [completedStoryKeySet, levels, unlockedLevelCount]);

  type FlatTopic = {
    slug: string;
    levelId: string;
    label: string;
    locked: boolean;
    coverUrl?: string | null;
    storyCount: number;
    stories: Array<{
      slug: string;
      title: string;
      href: string;
      coverUrl?: string | null;
      state: StoryNodeState;
    }>;
  };

  const flatTopics: FlatTopic[] = useMemo(() => {
    const out: FlatTopic[] = [];
    levels.forEach((level, levelIndex) => {
      const isLevelUnlocked = levelIndex < unlockedLevelCount;
      for (const topic of level.topics) {
        // Skip empty topics inside unlocked levels — they only add noise
        // (banner with no rows). Locked levels keep their empty topics so
        // the user sees the upcoming map of what's gated.
        if (isLevelUnlocked && topic.stories.length === 0) continue;
        const topicNextKey = nextStoryKeyByTopic.get(`${level.id}:${topic.slug}`);
        const stories = topic.stories.map((story) => {
          const isStoryComplete = isJourneyStoryComplete(story, completedStoryKeySet);
          const isNextRecommended =
            !!topicNextKey && story.progressKey === topicNextKey;

          let state: StoryNodeState;
          if (!isLevelUnlocked) {
            // Whole level is gated. Every story shows the lock icon.
            state = "locked";
          } else if (isStoryComplete) {
            state = "done";
          } else if (isNextRecommended) {
            state = "next";
          } else {
            // Inside an unlocked level the user can dive into any story
            // they want — only the level gate stops them.
            state = "available";
          }
          return {
            slug: story.storySlug,
            title: story.title,
            href: story.href,
            coverUrl: story.coverUrl,
            state,
          };
        });
        out.push({
          slug: topic.slug,
          levelId: level.id.toUpperCase(),
          label: topic.label,
          locked: !isLevelUnlocked,
          coverUrl: topic.stories[0]?.coverUrl ?? null,
          storyCount: topic.storyCount,
          stories,
        });
      }
    });
    return out;
  }, [completedStoryKeySet, levels, nextStoryKeyByTopic, unlockedLevelCount]);

  const languageHubTracks = useMemo(
    () =>
      tracks.map((track) => ({
        track,
        insights: buildJourneyTrackInsights(
          track,
          completedStoryKeySet,
          practicedTopicKeySet,
          passedCheckpointKeySet,
          dueReviewItems
        ),
      })),
    [
      completedStoryKeySet,
      dueReviewItems,
      passedCheckpointKeySet,
      practicedTopicKeySet,
      tracks,
    ]
  );

  if (!selectedTrack) return null;

  const language = pillForTrack(selectedTrack);

  return (
    <div className="dp-journey-page flex w-full flex-col gap-6 px-6 pb-20 pt-7 sm:px-10">
      <JourneyTopBar
        language={language}
        stats={stats}
        onTapLanguage={() => setLanguageSheetOpen(true)}
        onTapStats={() => setStatsSheetOpen(true)}
      />

      {tracks.length > 1 ? (
        <JourneyLanguageHub
          tracks={languageHubTracks}
          selectedTrackId={selectedTrack.id}
          onSelectTrack={(trackId) => {
            setSelectedVariantId(trackId);
            void trackJourneyMetric("journey_variant_selected", { variantId: trackId });
          }}
        />
      ) : null}

      <div className="flex flex-col">
        {flatTopics.map((topic, topicIndex) => {
          const color = TOPIC_PALETTE[topicIndex % TOPIC_PALETTE.length];
          const fallbackEmoji = topicEmoji(topic.label);
          return (
            <section key={`${topic.levelId}:${topic.slug}`} className="mb-2">
              <JourneyTopicBanner
                levelId={topic.levelId}
                title={topic.label}
                color={color}
                locked={topic.locked}
                onTap={() => {
                  if (topic.locked) return;
                  setPreviewTopic({
                    label: topic.label,
                    eyebrow: `Level ${topic.levelId}`,
                    description: `${topic.storyCount} ${topic.storyCount === 1 ? "story" : "stories"} in this topic.`,
                    coverUrl: topic.coverUrl,
                    storyCount: topic.storyCount,
                    stories: topic.stories.map((s) => ({ slug: s.slug, title: s.title })),
                    ctaHref: topic.stories[0]?.href ?? null,
                  });
                  void trackJourneyMetric(
                    "journey_topic_opened",
                    { variantId: selectedTrack.id, topicId: topic.slug, locked: topic.locked },
                    topic.slug
                  );
                }}
              />
              <div className="mb-6 flex flex-col">
                {topic.stories.map((story, i) => (
                  <JourneyStoryCard
                    key={story.slug}
                    story={{
                      href: story.href,
                      title: story.title,
                      coverUrl: story.coverUrl ?? undefined,
                      icon: fallbackEmoji,
                      state: story.state,
                    }}
                    color={color}
                    waveOffset={WAVE_PATTERN[i % WAVE_PATTERN.length]}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <TopicPreviewSheet
        open={previewTopic !== null}
        onClose={() => setPreviewTopic(null)}
        label={previewTopic?.label ?? ""}
        eyebrow={previewTopic?.eyebrow ?? null}
        description={previewTopic?.description ?? null}
        coverUrl={previewTopic?.coverUrl ?? null}
        storyCount={previewTopic?.storyCount ?? 0}
        stories={previewTopic?.stories ?? []}
        ctaHref={previewTopic?.ctaHref ?? null}
        ctaDisabledLabel={previewTopic?.ctaDisabledLabel ?? null}
      />

      {/* Language picker sheet (tap on flag pill in top bar). Mirrors the
          mobile LanguageSwitcher: lists every track with flag + label +
          variant; tap switches the active track. */}
      <BottomSheet
        open={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        eyebrow="Switch journey"
        title="Choose a language"
        ariaLabel="Language switcher"
      >
        <ul className="flex flex-col gap-2 pb-6">
          {tracks.map((track) => {
            const pill = pillForTrack(track);
            const isSelected = track.id === selectedTrack.id;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(track.id);
                    void trackJourneyMetric("journey_variant_selected", {
                      variantId: track.id,
                    });
                    setLanguageSheetOpen(false);
                  }}
                  className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-[color:var(--color-gold)]/60 bg-[color:var(--color-gold)]/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-2xl">
                    {pill.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold text-white">
                      {track.label}
                    </span>
                    <span className="block text-xs text-white/60">
                      {pill.code} · {track.variant ?? track.id}
                    </span>
                  </span>
                  {isSelected ? (
                    <span className="text-[color:var(--color-gold)] text-xl leading-none">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      {/* Stats sheet (tap on stats group in top bar). Mirrors the mobile
          progress sheet: shows energy / level / xp with their meaning
          and a link to the full /progress page. */}
      <BottomSheet
        open={statsSheetOpen}
        onClose={() => setStatsSheetOpen(false)}
        eyebrow="Your progress"
        title="Today's stats"
        ariaLabel="Progress overview"
      >
        <ul className="flex flex-col gap-2 pb-2">
          <li className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fb923c]/15 text-2xl">
              ⚡
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-white">
                Energy
              </span>
              <span className="block text-xs text-white/60">
                XP earned today
              </span>
            </span>
            <span className="text-[20px] font-black tabular-nums text-[#fb923c]">
              {stats.energy}
            </span>
          </li>
          <li className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--color-gold)]/15 text-2xl">
              🏆
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-white">
                Level
              </span>
              <span className="block text-xs text-white/60">
                Earn XP to level up
              </span>
            </span>
            <span className="text-[20px] font-black tabular-nums text-[color:var(--color-gold)]">
              Lv&nbsp;{stats.level}
            </span>
          </li>
          <li className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--color-cyan)]/15 text-2xl">
              ⭐
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-white">
                Total XP
              </span>
              <span className="block text-xs text-white/60">
                Across all journeys
              </span>
            </span>
            <span className="text-[20px] font-black tabular-nums text-[color:var(--color-cyan)]">
              {stats.xp >= 1000 ? `${(stats.xp / 1000).toFixed(1)}k` : stats.xp}
            </span>
          </li>
        </ul>
        <div className="pb-6 pt-3">
          <button
            type="button"
            onClick={() => {
              setStatsSheetOpen(false);
              router.push("/progress");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-gold)] px-4 py-3 text-[15px] font-extrabold text-[#2a1a02] hover:opacity-90"
          >
            View full progress
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
