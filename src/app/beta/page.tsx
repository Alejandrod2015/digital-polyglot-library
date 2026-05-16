import type { Metadata } from "next";
import BetaSignupForm from "./BetaSignupForm";
import BetaPhoneDemo from "@/components/marketing/BetaPhoneDemo";
import landing from "@/components/marketing/LandingPage.module.css";

export const metadata: Metadata = {
  title: "Join the beta · Digital Polyglot",
  description: "Apply for early access to the Digital Polyglot iOS app.",
  robots: { index: true, follow: true },
};

export default function BetaPage() {
  return (
    <main className={landing.page}>
      <div className={landing.frame}>
        <div className="mx-auto max-w-3xl pb-20 pt-12 sm:pt-16">
          <header className="mb-10 flex flex-col items-center text-center">
            <span className={landing.kicker}>
              <span className={landing.kickerDot} />
              iOS beta · TestFlight open
            </span>
            <h1
              className="mt-5 max-w-2xl text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
              style={{ letterSpacing: "-0.03em" }}
            >
              Stories that pull you{" "}
              <span className={landing.lime}>into a new language.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-white/65 sm:text-lg">
              We&apos;re inviting a small group to test the iOS app before
              launch. Apply in under a minute.
            </p>
          </header>

          <section className="mb-10 flex justify-center">
            <BetaPhoneDemo />
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
