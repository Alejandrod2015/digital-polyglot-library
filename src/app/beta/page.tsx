import type { Metadata } from "next";
import Image from "next/image";
import BetaSignupForm from "./BetaSignupForm";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description: "Apply for early access to the Digital Polyglot iOS app.",
  robots: { index: true, follow: true },
};

const SCREENSHOTS = [
  {
    src: "/beta/screen-reader.png",
    alt: "Story reader with vocabulary words highlighted and audio playback",
  },
  {
    src: "/beta/screen-listening.png",
    alt: "Listening practice mode with audio prompt and multiple-choice answers",
  },
];

export default function BetaPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[var(--bg-content)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.18),transparent_70%)]" />

      <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 sm:pt-16">
        <header className="mb-12 flex flex-col items-center text-center">
          <Image
            src="/digital-polyglot-logo.png"
            alt="Digital Polyglot"
            width={232}
            height={112}
            className="mb-6 h-20 w-auto sm:h-24"
            priority
          />
          <p className="mb-4 inline-block rounded-full border border-[var(--studio-accent)]/40 bg-[var(--studio-accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-accent)]">
            iOS Beta · TestFlight
          </p>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Stories that pull you into a new language.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            We&apos;re inviting a small group to test the iOS app before launch. Apply in under a minute.
          </p>
        </header>

        <section className="mb-12 flex items-center justify-center gap-6 sm:gap-10">
          {SCREENSHOTS.map((s) => (
            <div key={s.src} className="relative w-[170px] flex-shrink-0 sm:w-[210px]">
              <div className="absolute -left-[2px] top-[18%] h-[8%] w-[3px] rounded-l-sm bg-[#1a1a1d]" />
              <div className="absolute -left-[2px] top-[30%] h-[6%] w-[3px] rounded-l-sm bg-[#1a1a1d]" />
              <div className="absolute -left-[2px] top-[38%] h-[6%] w-[3px] rounded-l-sm bg-[#1a1a1d]" />
              <div className="absolute -right-[2px] top-[28%] h-[10%] w-[3px] rounded-r-sm bg-[#1a1a1d]" />
              <div className="relative rounded-[40px] bg-gradient-to-b from-[#202024] via-[#101013] to-[#0a0a0c] p-[8px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:rounded-[48px] sm:p-[10px]">
                <div
                  className="relative overflow-hidden rounded-[32px] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] sm:rounded-[38px]"
                  style={{ aspectRatio: "1170 / 2532" }}
                >
                  <Image
                    src={s.src}
                    alt={s.alt}
                    fill
                    sizes="(max-width: 640px) 170px, 210px"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute left-1/2 top-[1.2%] h-[3.4%] w-[34%] -translate-x-1/2 rounded-full bg-black" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <BetaSignupForm />

        <p className="mt-8 text-center text-xs text-[var(--muted)]">
          Questions?{" "}
          <a className="underline hover:text-[var(--foreground)]" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </div>
    </main>
  );
}
