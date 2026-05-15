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
        <path d="M12 3l1.9 4.6L19 9l-4 3.4L16.2 18 12 15.5 7.8 18 9 12.4 5 9l5.1-1.4L12 3z" />
      </svg>
    ),
    title: "Early access",
    body: "Be among the first to use the iOS app, weeks before public launch.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
    title: "Shape the product",
    body: "Your feedback directly informs what we build for heritage and serious learners.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M3 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M13 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M3 18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
        <path d="M7 8h0" />
        <path d="M17 8h0" />
      </svg>
    ),
    title: "Real content, real audio",
    body: "Stories and audiobooks crafted for learners who care about cultural depth.",
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
            Read your way into a new language.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            We&apos;re inviting a small group of readers to test the Digital Polyglot iOS app before launch.
            Apply in under a minute.
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

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          We read every application personally. Questions?{" "}
          <a className="underline hover:text-[var(--foreground)]" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </div>
    </main>
  );
}
