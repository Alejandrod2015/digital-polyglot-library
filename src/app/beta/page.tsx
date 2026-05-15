import type { Metadata } from "next";
import BetaSignupForm from "./BetaSignupForm";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description:
    "Apply for early access to the Digital Polyglot iOS app. Limited spots for heritage and serious language learners.",
  robots: { index: true, follow: true },
};

export default function BetaPage() {
  return (
    <main className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <header className="mb-10 text-center">
          <p className="mb-3 inline-block rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--chip-text)]">
            iOS Beta · TestFlight
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Join the Digital Polyglot beta
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            We&apos;re inviting a small group of readers to test the iOS app before launch. If you&apos;re a heritage
            speaker or a serious language learner, we&apos;d love your feedback.
          </p>
        </header>

        <BetaSignupForm />

        <p className="mt-10 text-center text-xs text-[var(--muted)]">
          Questions? Write to{" "}
          <a className="underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </div>
    </main>
  );
}
