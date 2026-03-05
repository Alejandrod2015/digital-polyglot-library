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
      className={`inline-flex h-5 items-center rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 text-[11px] font-semibold leading-none tracking-[0.02em] text-[var(--chip-text)] ${className}`}
    >
      {label}
    </span>
  );
}
