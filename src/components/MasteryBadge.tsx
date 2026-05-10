'use client';

import { getMasteryLevel, type MasteryInput } from '@/lib/mastery';

type MasteryBadgeProps = MasteryInput & {
  className?: string;
};

// Compact pill showing how well-mastered a vocabulary word is on a 1-5
// scale (gray = never practiced). Color + numeric "N/5" + label so the
// signal survives colorblindness; native `title` provides a tooltip with
// the description.
export function MasteryBadge({ className, ...input }: MasteryBadgeProps) {
  const mastery = getMasteryLevel(input);
  const numericLabel = mastery.level === 0 ? 'Nueva' : `${mastery.level}/5`;
  const ariaLabel = `Dominio: ${mastery.label}${mastery.level > 0 ? ` (${mastery.level} de 5)` : ''}`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${className ?? ''}`}
      style={{
        backgroundColor: mastery.bgColor,
        borderColor: mastery.borderColor,
        color: 'var(--foreground)',
      }}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: mastery.color }}
      />
      <span>{numericLabel}</span>
      <span className="text-[var(--muted)]">·</span>
      <span>{mastery.label}</span>
    </span>
  );
}
