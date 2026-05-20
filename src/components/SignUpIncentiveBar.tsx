"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackGa4Event } from "@/lib/ga4";

/**
 * Sticky bottom CTA that fades in after the user has scrolled past the
 * landing hero. Reinforces the primary "Get started free" path without
 * adding secondary links (per project rule: landing has one conversion
 * goal). Mobile-only — the desktop landing already has the CTA visible
 * via the marketing nav.
 */
export function SignUpIncentiveBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("signup-incentive-dismissed") === "1") {
      setDismissed(true);
      return;
    }
    const onScroll = () => {
      setVisible(window.scrollY > 360);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div
      role="region"
      aria-label="Sign up"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[rgba(7,15,30,0.94)] px-4 py-3 backdrop-blur sm:hidden"
      style={{ animation: "incentive-slide-up 220ms ease-out both" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold leading-snug text-white/92">
          Start free. Your progress saves automatically.
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-up"
            onClick={() => trackGa4Event("landing_cta_click", { cta: "sticky_bottom_signup" })}
            className="inline-flex items-center justify-center rounded-full bg-lime-300 px-3.5 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-slate-950"
          >
            Start free
          </Link>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("signup-incentive-dismissed", "1");
              setDismissed(true);
            }}
            aria-label="Dismiss"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes incentive-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
