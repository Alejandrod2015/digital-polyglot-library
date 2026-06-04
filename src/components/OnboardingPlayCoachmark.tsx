"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * One-time speech-bubble (viñeta) shown when a user lands on their free
 * story straight from onboarding (`?welcome=onboarding`). It explains why
 * they're here and points down at the player's play button. Dismissible;
 * dismissing clears the query param so a refresh won't show it again.
 */
export default function OnboardingPlayCoachmark() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(params.get("welcome") === "onboarding");
  }, [params]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    const next = new URLSearchParams(Array.from(params.entries()));
    next.delete("welcome");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="fixed inset-x-0 bottom-[6.75rem] z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto relative max-w-sm rounded-2xl bg-blue-600 text-white shadow-xl ring-1 ring-black/10 px-4 py-3 pr-9 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition"
        >
          ✕
        </button>
        <p className="text-sm leading-snug">
          <span className="font-semibold">This is your free story this week.</span>{" "}
          Press play below to start listening — audio and reading together.
        </p>
        {/* Tail pointing down toward the play button */}
        <div className="absolute left-1/2 -bottom-1.5 h-3 w-3 -translate-x-1/2 rotate-45 bg-blue-600" />
      </div>
    </div>
  );
}
