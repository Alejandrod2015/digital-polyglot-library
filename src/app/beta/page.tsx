import type { Metadata } from "next";
import Image from "next/image";
import BetaSignupForm from "./BetaSignupForm";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description:
    "Apply for early access to the Digital Polyglot iOS app. Limited spots for heritage and serious language learners.",
  robots: { index: true, follow: true },
};

const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const VALUE_BULLETS = [
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M3 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M13 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M3 18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
      </svg>
    ),
    title: "Stories worth finishing",
    body: "Real plots, real culture, real language. Not drills, not flashcards.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M3 12v3a9 9 0 0 0 18 0v-3" />
        <path d="M3 12a9 9 0 0 1 18 0" />
        <rect x="3" y="12" width="4" height="7" rx="1" />
        <rect x="17" y="12" width="4" height="7" rx="1" />
      </svg>
    ),
    title: "Native audio, word-synced",
    body: "Listen to native speakers at natural pace. Every word lights up as it's spoken.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    title: "Heritage-aware",
    body: "Built for learners who grew up around a language, not just those starting from zero.",
  },
];

export default function BetaPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.18),transparent_70%)]" />

      <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 sm:pt-16">
        <header className="mb-12 flex flex-col items-center text-center">
          <Image
            src="/digital-polyglot-logo.png"
            alt="Digital Polyglot"
            width={56}
            height={56}
            className="mb-6 h-14 w-14"
            priority
          />
          <p className="mb-4 inline-block rounded-full border border-[var(--studio-accent)]/40 bg-[var(--studio-accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-accent)]">
            iOS Beta · TestFlight
          </p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Stories that pull you into a new language.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Native-audio stories crafted for heritage speakers and serious learners. We&apos;re inviting a small
            group to test the iOS app before launch. Apply in under a minute.
          </p>
        </header>

        <section className="mb-10 grid gap-4 sm:grid-cols-3">
          {VALUE_BULLETS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]">
                {b.icon}
              </div>
              <h3 className="mb-1 text-sm font-bold text-[var(--foreground)]">{b.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{b.body}</p>
            </div>
          ))}
        </section>

        <BetaSignupForm />

        <div className="mt-8 flex flex-col items-center gap-3 text-center text-xs text-[var(--muted)]">
          <a
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2 font-semibold text-[var(--foreground)] transition hover:border-[var(--studio-accent)] hover:text-[var(--studio-accent)]"
            href="/explore"
          >
            Browse a sample story first
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
          <p>
            We review every application personally. Questions?{" "}
            <a className="underline hover:text-[var(--foreground)]" href="mailto:support@digitalpolyglot.com">
              support@digitalpolyglot.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
