"use client";

import { formatLevel } from "@/lib/displayFormat";

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
  beginner: "bg-emerald-500/15 border-emerald-400/40 text-emerald-200",
  intermediate: "bg-amber-500/15 border-amber-400/40 text-amber-200",
  advanced: "bg-rose-500/15 border-rose-400/40 text-rose-200",
  unknown: "bg-white/10 border-white/20 text-white/80",
};

export default function LevelBadge({ level, className = "" }: LevelBadgeProps) {
  const label = formatLevel(level);
  if (label === "—") return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.02em] ${levelStyles[normalizeLevel(
        level
      )]} ${className}`}
    >
      {label}
    </span>
  );
}

