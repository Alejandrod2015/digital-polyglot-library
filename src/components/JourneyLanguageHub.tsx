"use client";

import type { JourneyTrackInsights, JourneyVariantTrack } from "@/app/journey/journeyData";

type LanguageTheme = {
  flag: string;
  bg: string;
  accent: string;
};

const LANGUAGE_THEMES: Record<string, LanguageTheme> = {
  English: { flag: "🇬🇧", bg: "#152a4a", accent: "#5b9bd5" },
  Spanish: { flag: "🇪🇸", bg: "#301818", accent: "#e85d4a" },
  French: { flag: "🇫🇷", bg: "#1e1e38", accent: "#7b68ee" },
  German: { flag: "🇩🇪", bg: "#2a2816", accent: "#d4a843" },
  Italian: { flag: "🇮🇹", bg: "#162e1a", accent: "#4aba6e" },
  Portuguese: { flag: "🇧🇷", bg: "#163030", accent: "#3dbfa8" },
  Japanese: { flag: "🇯🇵", bg: "#2e1828", accent: "#e06090" },
  Korean: { flag: "🇰🇷", bg: "#162040", accent: "#6aadff" },
};

const DEFAULT_THEME: LanguageTheme = { flag: "🌐", bg: "#14243b", accent: "#84cc16" };

function themeForLabel(label: string): LanguageTheme {
  const normalized = label.trim();
  if (LANGUAGE_THEMES[normalized]) return LANGUAGE_THEMES[normalized];
  const head = normalized.split(/[\s—:·]/)[0]?.trim() ?? "";
  if (head && LANGUAGE_THEMES[head]) return LANGUAGE_THEMES[head];
  return DEFAULT_THEME;
}

export type JourneyLanguageHubTrack = {
  track: JourneyVariantTrack;
  insights: JourneyTrackInsights | null;
};

export function JourneyLanguageHub({
  tracks,
  selectedTrackId,
  onSelectTrack,
}: {
  tracks: JourneyLanguageHubTrack[];
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
}) {
  if (tracks.length === 0) return null;

  return (
    <section
      aria-label="Language journeys"
      className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(19,50,83,0.84),rgba(11,31,61,0.96))] px-4 py-3 sm:px-5"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-sky-100/72">
          Your languages
        </p>
        <p className="text-[0.7rem] font-semibold text-white/52">
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tracks.map(({ track, insights }) => {
          const theme = themeForLabel(track.label);
          const score = insights?.score ?? 0;
          const levelLabel = insights?.currentLevelId ?? null;
          const isActive = track.id === selectedTrackId;
          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelectTrack(track.id)}
              aria-pressed={isActive}
              data-testid={`qa-journey-language-${track.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`group relative overflow-hidden rounded-[1.1rem] border px-3 py-3 text-left transition active:scale-[0.99] ${
                isActive
                  ? "ring-2 ring-offset-2 ring-offset-[#0a2b56]"
                  : "hover:brightness-110"
              }`}
              style={{
                backgroundColor: theme.bg,
                borderColor: `${theme.accent}30`,
                ...(isActive ? { boxShadow: `0 0 0 2px ${theme.accent}88` } : null),
              }}
            >
              <span className="text-2xl leading-none">{theme.flag}</span>
              <p className="mt-2 text-sm font-extrabold tracking-tight text-white">
                {track.label}
              </p>
              {insights ? (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, score)}%`,
                        backgroundColor: theme.accent,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-black"
                      style={{ color: theme.accent }}
                    >
                      {score}%
                    </span>
                    {levelLabel ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]"
                        style={{
                          color: theme.accent,
                          backgroundColor: `${theme.accent}1f`,
                        }}
                      >
                        {levelLabel}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs font-semibold text-white/56">Tap to start</p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
