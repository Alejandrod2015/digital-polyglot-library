import type { Metadata } from "next";
import Image from "next/image";
import BetaSignupForm from "./BetaSignupForm";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description:
    "Apply for early access to the Digital Polyglot iOS app. Limited spots for heritage and serious language learners.",
  robots: { index: true, follow: true },
};

const VALUE_BULLETS = [
  {
    icon: "🎯",
    title: "Early access",
    body: "Be among the first to use the iOS app, weeks before public launch.",
  },
  {
    icon: "🗣️",
    title: "Shape the product",
    body: "Your feedback directly informs what we build for heritage and serious learners.",
  },
  {
    icon: "📚",
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
              <div className="mb-2 text-2xl" aria-hidden>
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
