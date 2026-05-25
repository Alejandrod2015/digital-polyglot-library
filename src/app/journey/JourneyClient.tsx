"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
// IMPORTANT: NO runtime imports de `./journeyData` acá.
// journeyData importa `@/lib/prisma` y este file es "use client".
// Si webpack ve un runtime import en la cadena, bundlea prisma al
// browser y peta con "PrismaClient is unable to run in this browser
// environment". Las funciones puras viven en journeyInsights y
// journeyUnlock. Los tipos van con `import type` (borrados en compile).
import { buildJourneyTrackInsights } from "./journeyInsights";
import {
  getJourneyPlacementLevelIndex,
  getUnlockedLevelCount,
} from "@/lib/journeyUnlock";
import type { JourneyTrackInsights, JourneyVariantTrack } from "./journeyData";
import { isJourneyStoryComplete } from "@/lib/journeyUnlock";
import type { JourneyDueReviewItem } from "@/lib/journeyProgress";
import { TopicPreviewSheet } from "@/components/TopicPreviewSheet";
import JourneyNextActionFab from "@/components/JourneyNextActionFab";
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

// Map the journey track variant code → language pill code + flag
// shown in the top bar. Acepta tanto códigos ISO ("de", "it") como
// language names completos ("german", "italian") porque el field
// `Journey.variant` viene en formato libre desde Studio. Sin esta
// expansión, "german" caía al fallback `.slice(0,2)` y mostraba "GE".
const LANGUAGE_PILL_BY_VARIANT: Record<string, { code: string; flag: string }> = {
  // ── ISO short codes ──
  latam: { code: "ES", flag: "🇲🇽" },
  spain: { code: "ES", flag: "🇪🇸" },
  br: { code: "PT", flag: "🇧🇷" },
  pt: { code: "PT", flag: "🇵🇹" },
  fr: { code: "FR", flag: "🇫🇷" },
  it: { code: "IT", flag: "🇮🇹" },
  de: { code: "DE", flag: "🇩🇪" },
  jp: { code: "JA", flag: "🇯🇵" },
  ja: { code: "JA", flag: "🇯🇵" },
  ko: { code: "KO", flag: "🇰🇷" },
  en: { code: "EN", flag: "🇬🇧" },
  // ── Language names completos (lo que más usa Studio) ──
  spanish: { code: "ES", flag: "🇪🇸" },
  portuguese: { code: "PT", flag: "🇧🇷" },
  brazilian: { code: "PT", flag: "🇧🇷" },
  french: { code: "FR", flag: "🇫🇷" },
  italian: { code: "IT", flag: "🇮🇹" },
  german: { code: "DE", flag: "🇩🇪" },
  japanese: { code: "JA", flag: "🇯🇵" },
  korean: { code: "KO", flag: "🇰🇷" },
  english: { code: "EN", flag: "🇬🇧" },
  chinese: { code: "ZH", flag: "🇨🇳" },
};

function pillForTrack(track: JourneyVariantTrack | null): { code: string; flag: string } {
  if (!track) return { code: "??", flag: "🌐" };
  // 1) Intentar primero por `variant` (latam, spain, br, etc.)
  const variantKey = (track.variant ?? "").toLowerCase();
  if (variantKey && LANGUAGE_PILL_BY_VARIANT[variantKey]) {
    return LANGUAGE_PILL_BY_VARIANT[variantKey];
  }
  // 2) Fallback por `language` del journey ("German" → DE 🇩🇪).
  //    Sin esto, journeys con variant=null o variant="german" caían
  //    al substring crudo "GE" / "??" en el pill del top bar.
  const languageKey = (track.language ?? "").toLowerCase();
  if (languageKey && LANGUAGE_PILL_BY_VARIANT[languageKey]) {
    return LANGUAGE_PILL_BY_VARIANT[languageKey];
  }
  // 3) Último fallback: globo + "??".
  return { code: "??", flag: "🌐" };
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

  // Resolver el variant inicial → CUID interno. El URL puede traer
  // slug ("traveler") o CUID legacy. El state SIEMPRE es el CUID
  // del track; sino, los lookups `tracks.find(t.id === state)` fallan
  // y el state se queda inconsistente con la URL, lo que dispara el
  // loop de re-sync. `initialVariantId` ya viene resuelto al CUID
  // desde el server loader.
  const initialStateCuid = (() => {
    if (tracks.some((track) => track.id === initialVariantId)) {
      return initialVariantId;
    }
    const urlVariant = searchParams.get("variant");
    if (urlVariant) {
      const matched = tracks.find(
        (t) => t.slug === urlVariant || t.id === urlVariant
      );
      if (matched) return matched.id;
    }
    return firstTrackId;
  })();
  const [selectedVariantId, setSelectedVariantId] = useState(initialStateCuid);
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
    storySlugs?: string[];
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

  // Track del último slug que NOSOTROS escribimos al URL. Sin este
  // ref, el efecto que sincroniza state → URL reacciona a su propio
  // `router.replace` (porque `searchParams` cambia en el render
  // siguiente), entra al loop y alterna entre tracks cada ~2s.
  const lastSyncedSlugRef = useRef<string | null>(null);

  // Sync state → URL. Único punto de update del URL: solo cuando
  // CAMBIA selectedVariantId. Si el slug calculado ya es el que
  // escribimos antes (o el que está en la URL), no-op.
  // Deliberadamente NO existe un effect URL → state: el initial
  // useState resuelve el variant desde la URL en mount y de ahí en
  // adelante los clicks del sheet son la única fuente de cambio.
  // Esto evita el loop, a cambio de no resincronizar con back/forward
  // del browser (trade-off aceptable; la página es full-reload-safe
  // gracias a `force-dynamic`).
  useEffect(() => {
    if (!selectedVariantId) return;
    const currentTrack = tracks.find((t) => t.id === selectedVariantId);
    const slugForUrl = currentTrack?.slug ?? selectedVariantId;
    if (lastSyncedSlugRef.current === slugForUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("variant") === slugForUrl) {
      lastSyncedSlugRef.current = slugForUrl;
      return;
    }
    lastSyncedSlugRef.current = slugForUrl;
    params.set("variant", slugForUrl);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedVariantId, tracks]);

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

  // Single GLOBAL "next" recommendation across the entire journey: the
  // first not-yet-complete story in the first incomplete topic of the
  // lowest unlocked level. Only this ONE story gets the pulsing halo +
  // float + button effects — same behavior as iPhone
  // (`globalJourneyNextStoryId` in MobileLibraryShell). Previously we
  // had one "next" per topic, which lit up the first story of every
  // topic and broke the "this is where to tap" cue.
  const globalNextStoryKey = useMemo<string | null>(() => {
    for (let i = 0; i < levels.length; i++) {
      if (i >= unlockedLevelCount) break;
      const level = levels[i];
      for (const topic of level.topics) {
        const firstIncomplete = topic.stories.find(
          (s) => !isJourneyStoryComplete(s, completedStoryKeySet)
        );
        if (firstIncomplete) return firstIncomplete.progressKey;
      }
    }
    return null;
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
        const stories = topic.stories.map((story) => {
          const isStoryComplete = isJourneyStoryComplete(story, completedStoryKeySet);
          const isNextRecommended =
            !!globalNextStoryKey && story.progressKey === globalNextStoryKey;

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
  }, [completedStoryKeySet, levels, globalNextStoryKey, unlockedLevelCount]);

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

      {/* JourneyLanguageHub (card "YOUR LANGUAGES" arriba del flow)
          removido para paridad con iPhone. Mobile usa solo el chip
          GE/DE/ES en el top bar (tap abre el sheet "Switch journey")
          como mecanismo único de cambio. Tener el hub grande arriba
          + el chip era duplicación visual y rompía el flow vertical
          del journey path. */}

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
                    storySlugs: topic.stories.map((s) => s.slug).filter(Boolean),
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

      <JourneyNextActionFab hasNext={globalNextStoryKey !== null} />

      <TopicPreviewSheet
        open={previewTopic !== null}
        onClose={() => setPreviewTopic(null)}
        label={previewTopic?.label ?? ""}
        eyebrow={previewTopic?.eyebrow ?? null}
        description={previewTopic?.description ?? null}
        coverUrl={previewTopic?.coverUrl ?? null}
        storyCount={previewTopic?.storyCount ?? 0}
        stories={previewTopic?.stories ?? []}
        storySlugs={previewTopic?.storySlugs ?? []}
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
                  className="flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors"
                  style={
                    isSelected
                      ? {
                          background: "rgba(252,211,77,0.12)",
                          borderColor: "rgba(252,211,77,0.55)",
                        }
                      : {
                          background: "var(--card-bg)",
                          borderColor: "var(--card-border)",
                        }
                  }
                >
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl"
                    style={{ background: "var(--card-bg-hover)" }}
                  >
                    {pill.flag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[15px] font-extrabold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {track.label}
                    </span>
                    <span
                      className="block text-xs"
                      style={{ color: "var(--muted)" }}
                    >
                      {pill.code} · {track.variant ?? track.slug}
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
          <li
            className="flex items-center gap-4 rounded-2xl border px-4 py-3"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--foreground)",
            }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fb923c]/15 text-2xl">
              ⚡
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[15px] font-extrabold"
                style={{ color: "var(--foreground)" }}
              >
                Energy
              </span>
              <span
                className="block text-xs"
                style={{ color: "var(--muted)" }}
              >
                XP earned today
              </span>
            </span>
            <span className="text-[20px] font-black tabular-nums text-[#fb923c]">
              {stats.energy}
            </span>
          </li>
          <li
            className="flex items-center gap-4 rounded-2xl border px-4 py-3"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--foreground)",
            }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--color-gold)]/15 text-2xl">
              🏆
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[15px] font-extrabold"
                style={{ color: "var(--foreground)" }}
              >
                Level
              </span>
              <span
                className="block text-xs"
                style={{ color: "var(--muted)" }}
              >
                Earn XP to level up
              </span>
            </span>
            <span className="text-[20px] font-black tabular-nums text-[color:var(--color-gold)]">
              Lv&nbsp;{stats.level}
            </span>
          </li>
          <li
            className="flex items-center gap-4 rounded-2xl border px-4 py-3"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--foreground)",
            }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--color-cyan)]/15 text-2xl">
              ⭐
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[15px] font-extrabold"
                style={{ color: "var(--foreground)" }}
              >
                Total XP
              </span>
              <span
                className="block text-xs"
                style={{ color: "var(--muted)" }}
              >
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
