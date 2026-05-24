import StoryBackLink from "@/components/StoryBackLink";
import { Suspense } from "react";

type Props = {
  children: React.ReactNode;
};

// iPhone parity: the back affordance lives as a FLOATING circular button
// in the top-left, always reachable regardless of scroll position. No
// inline top bar; the story owns the full viewport. See ReaderScreen.tsx
// (floatingBackButton style) for the mobile reference.
//
// The button is `position: fixed` (not absolute) so it stays in the
// top-left while the page scrolls, matching mobile's behavior. Suspense
// fallback is now a button-shaped <a href="/explore"> so taps before
// hydration also navigate somewhere sane — previously the fallback was
// a plain <div>, which is why early clicks felt unresponsive.
export default function PolyglotStoryLayout({ children }: Props) {
  return (
    <div className="relative flex flex-col min-h-full text-foreground">
      <Suspense
        fallback={
          <a
            href="/explore"
            aria-label="Back"
            className="fixed left-3 top-3 z-50 inline-grid h-10 w-10 place-items-center rounded-full border border-white/[0.12] bg-[rgba(4,9,17,0.78)] text-white/95 backdrop-blur-md md:left-6 md:top-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </a>
        }
      >
        <StoryBackLink
          floating
          fallbackHref="/explore"
          fallbackLabel="Back to Explore"
        />
      </Suspense>

      <main className="flex-1">{children}</main>
    </div>
  );
}
