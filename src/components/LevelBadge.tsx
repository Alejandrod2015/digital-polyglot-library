"use client";

import { formatLevel } from "@domain/displayFormat";

type LevelBadgeProps = {
  level?: string;
  className?: string;
};

function normalizeLevel(level?: string): "beginner" | "intermediate" | "advanced" | "unknown" {
  const v = (level ?? "").trim().toLowerCase();
  if (v.startsWith("beginner") || v.startsWith("basic") || v.startsWith("elementary")) {
    return "beginner";
  }
  if (v.startsWith("intermediate")) return "intermediate";
  if (v.startsWith("advanced")) return "advanced";
  return "unknown";
}

const levelStyles: Record<ReturnType<typeof normalizeLevel>, string> = {
  beginner:
    "bg-[var(--badge-beginner-bg)] border-[var(--badge-beginner-border)] text-[var(--badge-beginner-text)]",
  intermediate:
    "bg-[var(--badge-intermediate-bg)] border-[var(--badge-intermediate-border)] text-[var(--badge-intermediate-text)]",
  advanced:
    "bg-[var(--badge-advanced-bg)] border-[var(--badge-advanced-border)] text-[var(--badge-advanced-text)]",
  unknown: "bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--chip-text)]",
};

export default function LevelBadge({ level, className = "" }: LevelBadgeProps) {
  const label = formatLevel(level);
  if (label === "—") return null;

  return (
    <span
      className={`inline-flex h-5 shrink-0 whitespace-nowrap items-center rounded-full border px-2 text-[11px] font-semibold leading-none tracking-[0.02em] ${levelStyles[normalizeLevel(
        level
      )]} ${className}`}
    >
      {label}
    </span>
  );
}
