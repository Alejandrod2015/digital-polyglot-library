"use client";

import { formatVariant } from "@domain/displayFormat";

type VariantBadgeProps = {
  variant?: string | null;
  className?: string;
};

export default function VariantBadge({ variant, className = "" }: VariantBadgeProps) {
  const label = formatVariant(variant ?? undefined);
  if (label === "—") return null;

  return (
    <span
      className={`inline-flex h-5 shrink-0 whitespace-nowrap items-center rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 text-[11px] font-semibold leading-none tracking-[0.02em] text-[var(--chip-text)] ${className}`}
    >
      {label}
    </span>
  );
}
