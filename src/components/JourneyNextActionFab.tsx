"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

type Props = {
  /** Whether there's a current next-action story on the page. When
   *  false (everything completed or no journey loaded) the FAB hides. */
  hasNext: boolean;
};

/**
 * iPhone-parity yellow FAB at bottom-right of the Journey screen.
 *
 * Behavior:
 * - Visible only when (a) there's a global next-action story and
 *   (b) the user has scrolled away from it (it's not in the viewport).
 * - Tap → smooth-scrolls the next story card into ~45 % from the top
 *   of the viewport, matching the auto-center used on journey open.
 *
 * Locates the active card via `[data-journey-next="true"]` written by
 * JourneyStoryCard when its state is "next". One per page; the
 * validator's "single global next" rule guarantees uniqueness.
 *
 * Mobile reference: the chevron-up FAB at MobileLibraryShell.tsx:16630.
 */
export default function JourneyNextActionFab({ hasNext }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasNext) {
      setVisible(false);
      return;
    }
    function check() {
      const el = document.querySelector('[data-journey-next="true"]');
      if (!el) {
        setVisible(false);
        return;
      }
      const rect = (el as HTMLElement).getBoundingClientRect();
      const viewport = window.innerHeight;
      // Hide when the card is comfortably in the viewport (top edge
      // visible and not too low). 80 px buffer at the bottom keeps
      // the FAB hidden when the card sits just above the tab bar.
      const inView = rect.top >= -20 && rect.bottom <= viewport - 80;
      setVisible(!inView);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [hasNext]);

  function scrollToNext() {
    const el = document.querySelector('[data-journey-next="true"]');
    if (!el) return;
    const rect = (el as HTMLElement).getBoundingClientRect();
    const viewport = window.innerHeight;
    // Target = current page Y + rect.top - 45 % of viewport. The mobile
    // version uses 45 % (the gaze lands a hair above center).
    const target = window.scrollY + rect.top - viewport * 0.45;
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToNext}
      aria-label="Scroll to next story"
      title="Next story"
      className="fixed right-4 z-[55] inline-grid h-12 w-12 place-items-center rounded-full bg-[#fcd34d] text-[#0c1626] shadow-[0_8px_24px_-6px_rgba(252,211,77,0.55),0_6px_16px_-4px_rgba(0,0,0,0.35)] transition hover:brightness-105 active:translate-y-[2px] md:right-8"
      style={{
        // Sits above the mobile tab bar (~64-72px) with breathing
        // room. Desktop has no tab bar so the offset is purely
        // visual.
        bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <ChevronUp className="h-6 w-6" strokeWidth={2.6} />
    </button>
  );
}
