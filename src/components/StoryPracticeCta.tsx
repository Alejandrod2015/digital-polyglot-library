import Link from "next/link";

type StoryPracticeCtaProps = {
  practiceHref: string;
  practiceLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string | null;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export default function StoryPracticeCta({
  practiceHref,
  practiceLabel = "Practice this story",
  secondaryHref = null,
  secondaryLabel = null,
  eyebrow = "Next Step",
  title = "Lock this story in with a short practice round",
  description = "Review the key vocabulary while the story is still fresh, then keep moving.",
}: StoryPracticeCtaProps) {
  return (
    <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
            {description}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:min-w-[240px]">
          <Link
            href={practiceHref}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-white shadow-[0_16px_32px_rgba(47,103,238,0.26)] transition hover:opacity-95"
          >
            {practiceLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--bg-content)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--card-bg-hover)]"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
