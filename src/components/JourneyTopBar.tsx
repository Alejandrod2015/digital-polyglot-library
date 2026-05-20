"use client";

import { useUser } from "@clerk/nextjs";

type Stats = {
  /** Energy / lightning units shown in the topbar (orange icon). */
  energy?: number;
  /** Current CEFR level number (1-6) or label. */
  level?: number | string;
  /** Total XP / stars (cyan icon). */
  xp?: number;
};

type Language = {
  /** Short code shown in the pill (e.g. "ES", "IT"). */
  code: string;
  /** Emoji flag or single character. */
  flag: string;
};

type Props = {
  language: Language;
  stats?: Stats;
  /** Called when the language pill is tapped (opens the LanguageSwitcher sheet). */
  onTapLanguage?: () => void;
};

/**
 * Journey screen top bar. Language pill on the left, stats on the right.
 * Use this in place of the old <h1>+<level toggle> header.
 *
 * iPhone reference: the journey screen header (flag + IT + chevron · ⚡ 8 · 🏆 Lv 7 · ⭐ 1.4k).
 */
export default function JourneyTopBar({ language, stats, onTapLanguage }: Props) {
  const { user } = useUser();
  const fmtNum = (n?: number) => {
    if (n == null) return "0";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <header className="flex items-center justify-between gap-4 mb-8">
      <button
        type="button"
        onClick={onTapLanguage}
        className="inline-flex items-center gap-3 pr-4 pl-1.5 py-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] font-extrabold text-base text-[var(--foreground)] hover:bg-[var(--card-bg-hover)] transition-colors"
      >
        <span className="w-10 h-10 rounded-full bg-[var(--bg-1)] grid place-items-center text-2xl shrink-0">
          {language.flag}
        </span>
        <span className="tracking-wide">{language.code}</span>
        <span className="text-[var(--muted)] text-sm">▾</span>
      </button>

      <div className="inline-flex items-center gap-6 whitespace-nowrap font-black tabular-nums">
        <span className="inline-flex items-center gap-2 text-[#fb923c] text-[17px]">
          <span className="text-lg leading-none">⚡</span>
          {fmtNum(stats?.energy ?? 0)}
        </span>
        <span className="inline-flex items-center gap-2 text-[var(--color-gold)] text-[17px]">
          <span className="text-lg leading-none">🏆</span>
          Lv&nbsp;{stats?.level ?? 1}
        </span>
        <span className="inline-flex items-center gap-2 text-[var(--color-cyan)] text-[17px]">
          <span className="text-lg leading-none">⭐</span>
          {fmtNum(stats?.xp ?? 0)}
        </span>
      </div>
    </header>
  );
}
