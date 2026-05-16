import type { Metadata } from "next";
import Image from "next/image";
import BetaSignupForm from "./BetaSignupForm";
import landing from "@/components/marketing/LandingPage.module.css";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description: "Apply for early access to the Digital Polyglot iPhone app.",
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
    <main className={landing.page}>
      <div className={landing.frame}>
        <div className="mx-auto max-w-3xl pb-20 pt-12 sm:pt-16">
          <header className="mb-10 flex flex-col items-center text-center">
            <span className={landing.kicker}>
              <span className={landing.kickerDot} />
              iPhone beta · invite only
            </span>
            <h1
              className="mt-5 max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              Stories that pull you{" "}
              <span className={landing.lime}>into a new language.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-white/65 sm:text-lg">
              We&apos;re inviting a small group to test the iPhone app before
              launch. Apply in under a minute.
            </p>
          </header>

          <section className="mb-12 flex items-center justify-center gap-6 sm:gap-10">
            {SCREENSHOTS.map((s) => (
              <div
                key={s.src}
                className="relative w-[170px] flex-shrink-0 sm:w-[210px]"
              >
                <div className="absolute -left-[2px] top-[18%] h-[8%] w-[3px] rounded-l-sm bg-[#0a1322]" />
                <div className="absolute -left-[2px] top-[30%] h-[6%] w-[3px] rounded-l-sm bg-[#0a1322]" />
                <div className="absolute -left-[2px] top-[38%] h-[6%] w-[3px] rounded-l-sm bg-[#0a1322]" />
                <div className="absolute -right-[2px] top-[28%] h-[10%] w-[3px] rounded-r-sm bg-[#0a1322]" />
                <div className="relative rounded-[40px] bg-gradient-to-b from-[#13315e] via-[#0a2b56] to-[#051834] p-[8px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.08] sm:rounded-[48px] sm:p-[10px]">
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

          <p className="mt-8 text-center text-xs font-bold text-white/45">
            Questions?{" "}
            <a
              className="underline hover:text-[#fcd34d]"
              href="mailto:support@digitalpolyglot.com"
            >
              support@digitalpolyglot.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
