"use client";

import { formatLanguageCode } from "@/lib/displayFormat";

type LanguageBadgeProps = {
  language?: string;
  className?: string;
};

export default function LanguageBadge({ language, className = "" }: LanguageBadgeProps) {
  const label = formatLanguageCode(language);
  if (label === "—") return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--chip-text)] ${className}`}
    >
      {label}
    </span>
  );
}
