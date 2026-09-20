// /src/components/TopicCountryBadge.tsx
//
// Discrete, persistent signal in the reader header for LATAM journeys whose
// topics each live in a different country. Without it a beta tester reading
// the Argentine topic of a `latam` journey has no way to know the narrator
// isn't speaking their expected accent (Journey-planning-2 assignment,
// 2026-09-19).
//
// Renders NOTHING when `topicCountryLabel` returns null (single-country
// journeys, non-latam variants). Same badge intent as the mobile version;
// this file is the web half.

import Flag from "@/components/Flag";

type TopicCountryBadgeProps = {
  /** ISO alpha-2 code, e.g. "AR" (from `topicCountryIso`). */
  iso: string | null;
  /** Display label, e.g. "Argentina" (from `topicCountryLabel`). */
  label: string | null;
  className?: string;
};

export default function TopicCountryBadge({ iso, label, className = "" }: TopicCountryBadgeProps) {
  if (!label) return null;

  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 text-[11px] font-semibold leading-none tracking-[0.02em] text-[var(--chip-text)] ${className}`}
    >
      {iso ? <Flag code={iso} size={13} title={label} /> : null}
      {label}
    </span>
  );
}
